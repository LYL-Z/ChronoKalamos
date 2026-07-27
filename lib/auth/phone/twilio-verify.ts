import { normalizeChinaPhone } from "@/lib/auth/phone/config";
import { verifyTurnstileToken, type TurnstileVerification } from "@/lib/security/turnstile";

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

export class TwilioVerifyError extends Error {
  constructor(
    public readonly code:
      | "twilio_not_configured"
      | "twilio_request_failed"
      | "twilio_rejected"
      | "twilio_invalid_response"
      | "twilio_phone_invalid"
      | "twilio_turnstile_required",
    message: string,
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
    throw new TwilioVerifyError(
      "twilio_not_configured",
      "Twilio Verify 服务端配置尚未完成。",
    );
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
    throw new TwilioVerifyError(
      "twilio_request_failed",
      "Twilio Verify 暂时不可用。",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "message" in payload
      ? String((payload as { message?: unknown }).message ?? "")
      : "";
    throw new TwilioVerifyError(
      "twilio_rejected",
      message || `Twilio Verify 请求失败（HTTP ${response.status}）。`,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new TwilioVerifyError("twilio_invalid_response", "Twilio Verify 返回格式无效。");
  }
  return payload as TwilioResponse;
}

async function requireTurnstile(
  token: string,
  remoteIp: string | undefined,
  secret: string | undefined,
  fetcher: typeof fetch,
): Promise<TurnstileVerification> {
  try {
    return await verifyTurnstileToken({
      token,
      remoteIp,
      secret,
      expectedAction: "phone-auth",
      fetcher,
    });
  } catch (error) {
    throw new TwilioVerifyError(
      "twilio_turnstile_required",
      error instanceof Error ? error.message : "Turnstile 验证失败。",
    );
  }
}

export async function sendTwilioVerification({
  phone,
  turnstileToken,
  remoteIp,
  env = process.env,
  fetcher = fetch,
  timeoutMs = 8000,
}: {
  phone: string;
  turnstileToken: string;
  remoteIp?: string;
  env?: ServerEnv;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<TwilioVerifyResult> {
  const config = configFromEnvironment(env);
  const normalizedPhone = (() => {
    try {
      return normalizeChinaPhone(phone);
    } catch {
      throw new TwilioVerifyError("twilio_phone_invalid", "当前准备版只接受中国大陆 E.164 手机号。");
    }
  })();
  await requireTurnstile(turnstileToken, remoteIp, env.TURNSTILE_SECRET, fetcher);
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
  turnstileToken,
  remoteIp,
  env = process.env,
  fetcher = fetch,
  timeoutMs = 8000,
}: {
  phone: string;
  code: string;
  turnstileToken: string;
  remoteIp?: string;
  env?: ServerEnv;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<TwilioVerifyResult> {
  const config = configFromEnvironment(env);
  const normalizedPhone = (() => {
    try {
      return normalizeChinaPhone(phone);
    } catch {
      throw new TwilioVerifyError("twilio_phone_invalid", "当前准备版只接受中国大陆 E.164 手机号。");
    }
  })();
  const normalizedCode = code.trim();
  if (!/^\d{4,10}$/.test(normalizedCode)) {
    throw new TwilioVerifyError("twilio_rejected", "验证码格式无效。");
  }
  await requireTurnstile(turnstileToken, remoteIp, env.TURNSTILE_SECRET, fetcher);
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
