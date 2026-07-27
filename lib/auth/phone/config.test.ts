import { describe, expect, it } from "vitest";
import { getPhoneAuthReadiness, normalizeChinaPhone } from "./config";

describe("China phone preparation configuration", () => {
  it("normalizes mainland China numbers to E.164", () => {
    expect(normalizeChinaPhone("138 0013 8000")).toBe("+8613800138000");
    expect(normalizeChinaPhone("+8613800138000")).toBe("+8613800138000");
  });

  it("rejects non-mainland numbers", () => {
    expect(() => normalizeChinaPhone("+85261234567")).toThrow("phone_number_invalid");
  });

  it("stays in preparation until policy evidence is explicitly verified", () => {
    const readiness = getPhoneAuthReadiness({
      TWILIO_ACCOUNT_SID: "AC-test",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_VERIFY_SERVICE_SID: "VA-test",
      TURNSTILE_SITE_KEY: "0x-site",
      TURNSTILE_SECRET: "secret",
      PHONE_AUTH_ENABLED: "true",
      PHONE_AUTH_POLICY_VERIFIED: "false",
    });
    expect(readiness.enabled).toBe(false);
    expect(readiness.status).toBe("preparation");
    expect(readiness.policyGates.length).toBeGreaterThan(0);
  });
});
