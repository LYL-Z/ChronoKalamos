import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken, TurnstileVerificationError } from "./turnstile";

describe("Turnstile verification", () => {
  it("rejects when the server secret is absent", async () => {
    await expect(verifyTurnstileToken({
      token: "token",
      secret: "",
      fetcher: vi.fn(),
    })).rejects.toMatchObject({ code: "turnstile_not_configured" });
  });

  it("sends the secret only to Cloudflare and returns a safe result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      action: "phone-auth",
      hostname: "chronokalamos.com",
    }));

    const result = await verifyTurnstileToken({
      token: "challenge-token",
      secret: "server-secret",
      remoteIp: "203.0.113.4",
      expectedAction: "phone-auth",
      idempotencyKey: "0d72863e-0981-4d78-8825-0b6831ae2f44",
      fetcher,
    });

    expect(result).toMatchObject({ success: true, action: "phone-auth" });
    expect(result).not.toHaveProperty("secret");
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.body).toBeInstanceOf(URLSearchParams);
    expect(String(request?.body)).toContain("secret=server-secret");
    expect(String(request?.body)).toContain("response=challenge-token");
    expect(String(request?.body)).toContain("idempotency_key=0d72863e-0981-4d78-8825-0b6831ae2f44");
  });

  it("rejects an unexpected action", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      action: "login",
    }));

    await expect(verifyTurnstileToken({
      token: "challenge-token",
      secret: "server-secret",
      expectedAction: "phone-auth",
      fetcher,
    })).rejects.toMatchObject({
      code: "turnstile_rejected",
    } satisfies Partial<TurnstileVerificationError>);
  });

  it("rejects a missing token before making a network request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(verifyTurnstileToken({
      token: "",
      secret: "server-secret",
      fetcher,
    })).rejects.toMatchObject({ code: "turnstile_rejected" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a negative siteverify result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: false,
      "error-codes": ["invalid-input-response"],
    }));
    await expect(verifyTurnstileToken({
      token: "expired-token",
      secret: "server-secret",
      fetcher,
    })).rejects.toMatchObject({ code: "turnstile_rejected" });
  });
});
