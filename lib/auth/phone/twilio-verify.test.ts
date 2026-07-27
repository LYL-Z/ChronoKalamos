import { describe, expect, it, vi } from "vitest";
import { checkTwilioVerification, sendTwilioVerification, TwilioVerifyError } from "./twilio-verify";

const env = {
  TWILIO_ACCOUNT_SID: "AC-test",
  TWILIO_AUTH_TOKEN: "auth-token",
  TWILIO_VERIFY_SERVICE_SID: "VA-test",
};

describe("Twilio Verify adapter", () => {
  it("sends a verification request without exposing a Turnstile secret", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      sid: "VE-test",
      status: "pending",
      to: "+8613800138000",
      channel: "sms",
    }));

    const result = await sendTwilioVerification({ phone: "13800138000", env, fetcher });

    expect(result.status).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toContain("/Verifications");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("To=%2B8613800138000");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("Channel=sms");
    expect(String(fetcher.mock.calls[0]?.[1]?.headers && new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization"))).toContain("Basic ");
  });

  it("maps an approved verification check", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      sid: "VE-test",
      status: "approved",
      to: "+8613800138000",
      channel: "sms",
    }));

    const result = await checkTwilioVerification({ phone: "+8613800138000", code: "123456", env, fetcher });

    expect(result.status).toBe("approved");
    expect(fetcher.mock.calls[0]?.[0]).toContain("/VerificationCheck");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("Code=123456");
  });

  it.each([
    [21608, "The phone number is not verified", "phone_number_unverified"],
    [20429, "Too many requests", "rate_limited"],
    [60200, "Invalid parameter", "invalid_parameter"],
  ] as const)("normalizes Twilio error %s", async (code, message, expected) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code, message }, { status: code === 20429 ? 429 : 400 }));
    await expect(sendTwilioVerification({ phone: "13800138000", env, fetcher })).rejects.toMatchObject({
      code: expected,
    } satisfies Partial<TwilioVerifyError>);
  });

  it("maps an insufficient balance response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: "Insufficient balance" }, { status: 402 }));
    await expect(sendTwilioVerification({ phone: "13800138000", env, fetcher })).rejects.toMatchObject({
      code: "insufficient_balance",
    } satisfies Partial<TwilioVerifyError>);
  });
});
