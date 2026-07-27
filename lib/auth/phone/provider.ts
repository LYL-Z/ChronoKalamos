import { checkTwilioVerification, sendTwilioVerification, TwilioVerifyError, type TwilioVerifyResult } from "@/lib/auth/phone/twilio-verify";
import type { PhoneAuthProviderMode } from "@/lib/auth/phone/config";

export type PhoneProviderErrorCode =
  | "phone_auth_disabled"
  | "phone_number_unverified"
  | "insufficient_balance"
  | "rate_limited"
  | "invalid_parameter"
  | "provider_unavailable"
  | "provider_rejected"
  | "twilio_not_configured";

export class PhoneProviderError extends Error {
  constructor(
    public readonly code: PhoneProviderErrorCode,
    message: string,
    public readonly status = 503,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PhoneProviderError";
  }
}

export interface PhoneAuthProvider {
  send(phone: string): Promise<TwilioVerifyResult>;
  check(phone: string, code: string): Promise<TwilioVerifyResult>;
}

class MockPhoneAuthProvider implements PhoneAuthProvider {
  async send(): Promise<TwilioVerifyResult> {
    throw new PhoneProviderError("phone_auth_disabled", "手机号登录当前处于准备阶段，未发送真实短信。", 503);
  }

  async check(): Promise<TwilioVerifyResult> {
    throw new PhoneProviderError("phone_auth_disabled", "手机号登录当前处于准备阶段，未校验真实短信。", 503);
  }
}

class TwilioPhoneAuthProvider implements PhoneAuthProvider {
  async send(phone: string): Promise<TwilioVerifyResult> {
    try {
      return await sendTwilioVerification({ phone });
    } catch (error) {
      if (error instanceof TwilioVerifyError) {
        const status = error.code === "rate_limited" ? 429 : error.code === "invalid_parameter" ? 400 : error.code === "phone_number_unverified" ? 422 : error.code === "insufficient_balance" ? 503 : 502;
        throw new PhoneProviderError(error.code, error.message, status, error.retryable);
      }
      throw error;
    }
  }

  async check(phone: string, code: string): Promise<TwilioVerifyResult> {
    try {
      return await checkTwilioVerification({ phone, code });
    } catch (error) {
      if (error instanceof TwilioVerifyError) {
        const status = error.code === "rate_limited" ? 429 : error.code === "invalid_parameter" ? 400 : error.code === "phone_number_unverified" ? 422 : error.code === "insufficient_balance" ? 503 : 502;
        throw new PhoneProviderError(error.code, error.message, status, error.retryable);
      }
      throw error;
    }
  }
}

export function getPhoneAuthProvider(mode: PhoneAuthProviderMode): PhoneAuthProvider {
  return mode === "twilio" ? new TwilioPhoneAuthProvider() : new MockPhoneAuthProvider();
}
