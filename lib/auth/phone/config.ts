import { z } from "zod";

export const phoneAuthMarket = "CN-mainland" as const;
export const phoneAuthProvider = "twilio-verify" as const;
export const phoneAuthCaptcha = "cloudflare-turnstile" as const;

const runtimeEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().trim().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().trim().min(1).optional(),
  TURNSTILE_SITE_KEY: z.string().trim().min(1).optional(),
  TURNSTILE_SECRET: z.string().trim().min(1).optional(),
  PHONE_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
  PHONE_AUTH_POLICY_VERIFIED: z.enum(["true", "false"]).optional(),
});

export type PhoneAuthReadiness = {
  capability: "phone-auth";
  status: "preparation" | "enabled";
  market: typeof phoneAuthMarket;
  provider: typeof phoneAuthProvider;
  captcha: typeof phoneAuthCaptcha;
  enabled: boolean;
  missingConfiguration: string[];
  policyGates: string[];
};

const requiredConfiguration = [
  ["TWILIO_ACCOUNT_SID", "Twilio account SID"],
  ["TWILIO_AUTH_TOKEN", "Twilio auth token"],
  ["TWILIO_VERIFY_SERVICE_SID", "Twilio Verify Service SID"],
  ["TURNSTILE_SITE_KEY", "Turnstile site key"],
  ["TURNSTILE_SECRET", "Turnstile secret"],
] as const;

export function getPhoneAuthReadiness(
  rawEnv: Record<string, string | undefined> = process.env,
): PhoneAuthReadiness {
  const env = runtimeEnvSchema.parse(rawEnv);
  const missingConfiguration = requiredConfiguration
    .filter(([key]) => !env[key as keyof typeof env])
    .map(([, label]) => label);
  const policyGates = env.PHONE_AUTH_POLICY_VERIFIED === "true"
    ? []
    : [
        "中国大陆短信送达与 Twilio 地理权限",
        "成本、账号/IP 速率限制与异常停发",
        "phone_change 清理、冲突和恢复政策",
        "Twilio Verify + Turnstile + Supabase Auth 沙箱验收",
      ];
  const enabled = env.PHONE_AUTH_ENABLED === "true"
    && missingConfiguration.length === 0
    && policyGates.length === 0;

  return {
    capability: "phone-auth",
    status: enabled ? "enabled" : "preparation",
    market: phoneAuthMarket,
    provider: phoneAuthProvider,
    captcha: phoneAuthCaptcha,
    enabled,
    missingConfiguration,
    policyGates,
  };
}

export function isPhoneAuthRuntimeEnabled(
  rawEnv: Record<string, string | undefined> = process.env,
): boolean {
  return getPhoneAuthReadiness(rawEnv).enabled;
}

export function normalizeChinaPhone(input: string): string {
  const normalized = input.normalize("NFKC").trim().replace(/[\s()-]/g, "");
  if (/^1[3-9]\d{9}$/.test(normalized)) return `+86${normalized}`;
  if (/^\+861[3-9]\d{9}$/.test(normalized)) return normalized;
  throw new Error("phone_number_invalid");
}

export function maskPhone(phone: string): string {
  const normalized = normalizeChinaPhone(phone);
  return `${normalized.slice(0, 6)}••••${normalized.slice(-2)}`;
}
