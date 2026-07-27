import { z } from "zod";

export const phoneAuthMarket = "CN-mainland" as const;
export const phoneAuthProvider = "twilio-verify" as const;
export const phoneAuthCaptcha = "cloudflare-turnstile" as const;

export type PhoneAuthProviderMode = "mock" | "twilio";

const runtimeEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().trim().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().trim().min(1).optional(),
  TURNSTILE_SITE_KEY: z.string().trim().min(1).optional(),
  TURNSTILE_SECRET: z.string().trim().min(1).optional(),
  TURNSTILE_EXPECTED_HOSTNAME: z.string().trim().min(1).optional(),
  PHONE_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
  PHONE_AUTH_PROVIDER: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.enum(["mock", "twilio"]),
  ).optional(),
  PHONE_AUTH_POLICY_VERIFIED: z.enum(["true", "false"]).optional(),
  PHONE_AUTH_AUDIT_SALT: z.string().trim().min(16).optional(),
  PHONE_AUTH_DAILY_LIMIT: z.string().regex(/^\d+$/).optional(),
});

export type PhoneAuthReadiness = {
  capability: "phone-auth";
  status: "preparation" | "enabled";
  market: typeof phoneAuthMarket;
  provider: typeof phoneAuthProvider;
  providerMode: PhoneAuthProviderMode;
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
  ["PHONE_AUTH_AUDIT_SALT", "phone audit salt"],
] as const;

function providerMode(rawEnv: Record<string, string | undefined>): PhoneAuthProviderMode {
  const value = rawEnv.PHONE_AUTH_PROVIDER?.trim().toLowerCase();
  return value === "twilio" ? "twilio" : "mock";
}

export function getPhoneAuthReadiness(
  rawEnv: Record<string, string | undefined> = process.env,
): PhoneAuthReadiness {
  const env = runtimeEnvSchema.parse(rawEnv);
  const mode = providerMode(env);
  const missingConfiguration = requiredConfiguration
    .filter(([key]) => !env[key as keyof typeof env])
    .map(([, label]) => label);
  const policyGates = env.PHONE_AUTH_POLICY_VERIFIED === "true"
    ? []
    : [
        "中国大陆短信送达、Twilio 地理权限与资质",
        "成本、账号/IP 速率限制与异常熔断",
        "换号、号码回收、SIM swap 与账号恢复政策",
        "Twilio Verify + Turnstile + Supabase Auth 沙盒验收",
      ];
  const enabled = mode === "twilio"
    && env.PHONE_AUTH_ENABLED === "true"
    && missingConfiguration.length === 0
    && policyGates.length === 0;

  return {
    capability: "phone-auth",
    status: enabled ? "enabled" : "preparation",
    market: phoneAuthMarket,
    provider: phoneAuthProvider,
    providerMode: mode,
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

export function phoneAuthDailyLimit(
  rawEnv: Record<string, string | undefined> = process.env,
): number {
  const candidate = Number(rawEnv.PHONE_AUTH_DAILY_LIMIT ?? 20);
  return Number.isInteger(candidate) && candidate >= 1 && candidate <= 10_000 ? candidate : 20;
}

export function normalizeChinaPhone(input: string): string {
  const normalized = input.normalize("NFKC").trim().replace(/[\s()-]/g, "");
  if (/^1[3-9]\d{9}$/.test(normalized)) return `+86${normalized}`;
  if (/^\+861[3-9]\d{9}$/.test(normalized)) return normalized;
  throw new Error("phone_number_invalid");
}

export function maskPhone(phone: string): string {
  const normalized = normalizeChinaPhone(phone);
  return `${normalized.slice(0, 6)}•••••${normalized.slice(-2)}`;
}
