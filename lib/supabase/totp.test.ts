import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  completeTotpChallenge,
  getTotpMfaSnapshot,
  removeTotpFactor,
  startTotpEnrollment,
  totpQrCodeSource,
} from "./totp";

function clientWithMfa(mfa: Record<string, unknown>): SupabaseClient {
  return { auth: { mfa } } as unknown as SupabaseClient;
}

describe("Supabase TOTP helpers", () => {
  it("detects an aal2 challenge and lists only TOTP factors", async () => {
    const client = clientWithMfa({
      listFactors: vi.fn().mockResolvedValue({
        data: {
          all: [
            {
              id: "totp-1",
              factor_type: "totp",
              friendly_name: "主验证器",
              status: "verified",
              created_at: "2026-07-27T01:00:00Z",
            },
            {
              id: "phone-1",
              factor_type: "phone",
              status: "verified",
              created_at: "2026-07-27T02:00:00Z",
            },
          ],
        },
        error: null,
      }),
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
        data: {
          currentLevel: "aal1",
          nextLevel: "aal2",
          currentAuthenticationMethods: ["password"],
        },
        error: null,
      }),
    });

    await expect(getTotpMfaSnapshot(client)).resolves.toMatchObject({
      currentLevel: "aal1",
      nextLevel: "aal2",
      requiresChallenge: true,
      factors: [{ id: "totp-1", friendlyName: "主验证器", status: "verified" }],
    });
  });

  it("enrolls a TOTP factor without exposing the secret outside the result", async () => {
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: "factor-1",
        type: "totp",
        totp: {
          qr_code: "<svg><path /></svg>",
          secret: "PRIVATE-TOTP-SECRET",
          uri: "otpauth://totp/example",
        },
      },
      error: null,
    });
    const client = clientWithMfa({ enroll });

    const enrollment = await startTotpEnrollment(client, "主验证器");

    expect(enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "主验证器",
      issuer: "ChronoKalamos",
    });
    expect(enrollment.factorId).toBe("factor-1");
    expect(enrollment.secret).toBe("PRIVATE-TOTP-SECRET");
    expect(enrollment.qrCode).toMatch(/^data:image\/svg\+xml/);
  });

  it("validates and submits a six-digit challenge", async () => {
    const challengeAndVerify = vi.fn().mockResolvedValue({
      data: { access_token: "token" },
      error: null,
    });
    const client = clientWithMfa({ challengeAndVerify });

    await completeTotpChallenge(client, "factor-1", "123 456");

    expect(challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      code: "123456",
    });
    await expect(completeTotpChallenge(client, "factor-1", "12ab")).rejects.toThrow(
      "6 位数字",
    );
  });

  it("removes only the requested factor", async () => {
    const unenroll = vi.fn().mockResolvedValue({
      data: { id: "factor-2" },
      error: null,
    });
    const client = clientWithMfa({ unenroll });

    await removeTotpFactor(client, "factor-2");

    expect(unenroll).toHaveBeenCalledWith({ factorId: "factor-2" });
  });

  it("preserves an existing data URI", () => {
    expect(totpQrCodeSource("data:image/svg+xml;utf-8,svg")).toBe(
      "data:image/svg+xml;utf-8,svg",
    );
  });
});
