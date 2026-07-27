import { normalizeChinaPhone } from "@/lib/auth/phone/config";

type ServerEnv = Record<string, string | undefined>;

export type TwilioVerifyConfig = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
};

export type TwilioVerifyResult = {
  sid?: string;
  status: "pending" | "approved" | "canceled" | "expired" | "unknown";
  to: string;
  channel: string;
};

export type TwilioErrorCode =
  | "phone_number_unverified"
  | "insufficient_balance"
  | "rate_limited"
  | "invalid_parameter"
  | "provider_unavailable"
  | "provider_rejected"
  | "twilio_not_configured";

export class TwilioVerifyError extends Error {
  constructor(
    public readonly code: TwilioErrorCode,
    message: string,
    public readonly providerCode?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "TwilioVerifyError";
  }
}

type TwilioResponse = {
  sid?: string;
  status?: string;
  to?: string;
  channel?: string;
  message?: string;
  code?: number;
};

function configFromEnvironment(env: ServerEnv = process.env): TwilioVerifyConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid || !authToken || !serviceSid) {
    throw new TwilioVerifyError("twilio_not_configured", "Twilio Verify 服务端密钥尚未配置。");
  }
  return { accountSid, authToken, serviceSid };
}

function statusFrom(value: string | undefined): TwilioVerifyResult["status"] {
  if (value === "pending" || value === "approved" || value === "canceled" || value === "expired") return value;
  return "unknown";
}

function authorizationHeader(config: TwilioVerifyConfig): string {
  return `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`, "utf8").toString("base64")}`;
}

function mapProviderError(status: number, payload: TwilioResponse): TwilioVerifyError {
  const message = payload.message?.trim() ?? "";
  const lower = message.toLowerCase();
  const code = payload.code;
  if (code === 21608 || /unverified|not verified|trial account/.test(lower)) {
    return new TwilioVerifyError("phone_number_unverified", "试用账号只能向已验证的目的号码发送验证码。", code);
  }
  if (code === 60202 || code === 60203 || code === 20429 || status === 429 || /too many|rate limit|maximum.*attempt/.test(lower)) {
    return new TwilioVerifyError("rate_limited", "验证码请求过于频繁，请稍后再试。", code, true);
  }
  if (status === 402 || /insufficient|balance|credit|funds/.test(lower)) {
    return new TwilioVerifyError("insufficient_balance", "短信供应商余额或额度不足，已停止继续发送。", code);
  }
  if (code === 60200 || /invalid parameter|invalid phone|bad request|malformed/.test(lower)) {
    return new TwilioVerifyError("invalid_parameter", "手机号或验证码参数无效。", code);
  }
  if (code === 60212 || code === 60410 || status >= 500) {
    return new TwilioVerifyError("provider_unavailable", "短信供应商暂时不可用，请稍后再试。", code, true);
  }
  return new TwilioVerifyError(
    "provider_rejected",
    message || `短信供应商拒绝请求（HTTP ${status}）。`,
    code,
  );
}

async function twilioRequest(
  path: string,
  form: URLSearchParams,
  config: TwilioVerifyConfig,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<TwilioResponse> {
  let response: Response;
  try {
    response = await fetcher(`https://verify.twilio.com/v2/Services/${config.serviceSid}/${path}`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(config),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new TwilioVerifyError("provider_unavailable", "Twilio Verify 暂时不可用，请稍后再试。", undefined, true);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const safePayload = payload && typeof payload === "object" ? payload as TwilioResponse : {};
    throw mapProviderError(response.status, safePayload);
  }
  if (!payload || typeof payload !== "object") {
    throw new TwilioVerifyError("provider_unavailable", "Twilio Verify 返回格式无效。", undefined, true);
  }
  return payload as TwilioResponse;
}

function normalizedPhoneOrThrow(phone: string): string {
  try {
    return normalizeChinaPhone(phone);
  } catch {
    throw new TwilioVerifyError("invalid_parameter", "当前准备版只接受中国大陆 E.164 手机号。");
  }
}

export async function sendTwilioVerification({
  phone,
  env = process.env,
  fetcher = fetch,
  timeoutMs = 8000,
}: {
  phone: string;
  env?: ServerEnv;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<TwilioVerifyResult> {
  const config = configFromEnvironment(env);
  const normalizedPhone = normalizedPhoneOrThrow(phone);
  const payload = await twilioRequest(
    "Verifications",
    new URLSearchParams({ To: normalizedPhone, Channel: "sms" }),
    config,
    fetcher,
    timeoutMs,
  );
  return {
    sid: payload.sid,
    status: statusFrom(payload.status),
    to: payload.to ?? normalizedPhone,
    channel: payload.channel ?? "sms",
  };
}

export async function checkTwilioVerification({
  phone,
  code,
  env = process.env,
  fetcher = fetch,
  timeoutMs = 8000,
}: {
  phone: string;
  code: string;
  env?: ServerEnv;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<TwilioVerifyResult> {
  const config = configFromEnvironment(env);
  const normalizedPhone = normalizedPhoneOrThrow(phone);
  const normalizedCode = code.trim();
  if (!/^\d{4,10}$/.test(normalizedCode)) {
    throw new TwilioVerifyError("invalid_parameter", "验证码格式无效。");
  }
  const payload = await twilioRequest(
    "VerificationCheck",
    new URLSearchParams({ To: normalizedPhone, Code: normalizedCode }),
    config,
    fetcher,
    timeoutMs,
  );
  return {
    sid: payload.sid,
    status: statusFrom(payload.status),
    to: payload.to ?? normalizedPhone,
    channel: payload.channel ?? "sms",
  };
}
