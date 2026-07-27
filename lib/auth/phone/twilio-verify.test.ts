import { describe, expect, it, vi } from "vitest";
import { sendTwilioVerification, checkTwilioVerification } from "./twilio-verify";

const env = {
  TWILIO_ACCOUNT_SID: "AC-test",
  TWILIO_AUTH_TOKEN: "auth-token",
  TWILIO_VERIFY_SERVICE_SID: "VA-test",
  TURNSTILE_SECRET: "turnstile-secret",
};

function successfulTurnstile() {
  return Response.json({ success: true, action: "phone-auth", hostname: "chronokalamos.com" });
}

describe("Twilio Verify adapter", () => {
  it("verifies Turnstile before requesting an SMS", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({
        sid: "VE-test",
        status: "pending",
        to: "+8613800138000",
        channel: "sms",
      }));

    const result = await sendTwilioVerification({
      phone: "13800138000",
      turnstileToken: "challenge",
      env,
      fetcher,
    });

    expect(result.status).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toContain("/Verifications");
    const request = fetcher.mock.calls[1]?.[1];
    expect(request?.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(String(request?.body)).toContain("To=%2B8613800138000");
    expect(String(request?.body)).toContain("Channel=sms");
    expect(String(request?.headers && new Headers(request.headers).get("Authorization"))).toContain("Basic ");
  });

  it("maps an approved verification check", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({
        sid: "VE-test",
        status: "approved",
        to: "+8613800138000",
        channel: "sms",
      }));

    const result = await checkTwilioVerification({
      phone: "+8613800138000",
      code: "123456",
      turnstileToken: "challenge",
      env,
      fetcher,
    });

    expect(result.status).toBe("approved");
    expect(fetcher.mock.calls[1]?.[0]).toContain("/VerificationCheck");
    expect(String(fetcher.mock.calls[1]?.[1]?.body)).toContain("Code=123456");
  });
});
