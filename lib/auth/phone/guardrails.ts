import { createServerSupabaseClient } from "@/lib/game/supabase-repository";
import { maskPhone, normalizeChinaPhone, phoneAuthDailyLimit } from "@/lib/auth/phone/config";
import { z } from "zod";

const reservationSchema = z.object({
  status: z.enum(["reserved", "duplicate", "phone_cooldown", "ip_daily_limit", "daily_limit"]),
  result_code: z.string().optional(),
  provider_status: z.string().nullable().optional(),
  request_id: z.string().uuid().optional(),
  phone_count: z.number().int().nonnegative().optional(),
  ip_count: z.number().int().nonnegative().optional(),
  daily_count: z.number().int().nonnegative().optional(),
});

export type PhoneReservation = z.infer<typeof reservationSchema>;

export class PhoneGuardrailError extends Error {
  constructor(
    public readonly code: "guardrails_not_configured" | "guardrail_db_failed",
    message: string,
  ) {
    super(message);
    this.name = "PhoneGuardrailError";
  }
}

function requireSalt(env: Record<string, string | undefined> = process.env): string {
  const salt = env.PHONE_AUTH_AUDIT_SALT?.trim();
  if (!salt || salt.length < 16) {
    throw new PhoneGuardrailError("guardrails_not_configured", "手机号审计盐尚未配置。");
  }
  return salt;
}

async function digest(value: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  const bytes = new TextEncoder().encode(`${requireSalt(env)}:${value}`);
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
}

export async function auditIdentifiers(
  phone: string,
  ip: string,
  env: Record<string, string | undefined> = process.env,
): Promise<{ normalizedPhone: string; phoneHash: string; phoneMasked: string; ipHash: string }> {
  const normalizedPhone = normalizeChinaPhone(phone);
  const [phoneHash, ipHash] = await Promise.all([digest(normalizedPhone, env), digest(ip, env)]);
  return { normalizedPhone, phoneHash, phoneMasked: maskPhone(normalizedPhone), ipHash };
}

export async function reservePhoneSend({
  requestId,
  phone,
  ip,
  provider,
  env = process.env,
}: {
  requestId: string;
  phone: string;
  ip: string;
  provider: "mock" | "twilio";
  env?: Record<string, string | undefined>;
}): Promise<PhoneReservation> {
  const identifiers = await auditIdentifiers(phone, ip, env);
  const client = createServerSupabaseClient();
  const { data, error } = await client.rpc("reserve_phone_auth_send", {
    p_request_id: requestId,
    p_phone_hash: identifiers.phoneHash,
    p_phone_masked: identifiers.phoneMasked,
    p_ip_hash: identifiers.ipHash,
    p_provider: provider,
    p_phone_window_seconds: 60,
    p_ip_daily_limit: 10,
    p_daily_limit: phoneAuthDailyLimit(env),
  });
  if (error) throw new PhoneGuardrailError("guardrail_db_failed", `手机号限流记录失败：${error.message}`);
  return reservationSchema.parse(data);
}

export async function completePhoneSend({
  requestId,
  resultCode,
  providerStatus,
  providerRequestId,
  metadata = {},
}: {
  requestId: string;
  resultCode: string;
  providerStatus?: string;
  providerRequestId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const client = createServerSupabaseClient();
  const { error } = await client.rpc("complete_phone_auth_send", {
    p_request_id: requestId,
    p_result_code: resultCode,
    p_provider_status: providerStatus ?? null,
    p_provider_request_id: providerRequestId ?? null,
    p_metadata: metadata,
  });
  if (error) throw new PhoneGuardrailError("guardrail_db_failed", `手机号审计写入失败：${error.message}`);
}

export async function recordPhoneAudit({
  requestId,
  operation,
  phone,
  ip,
  provider,
  resultCode,
  providerStatus,
  providerRequestId,
  metadata = {},
  env = process.env,
}: {
  requestId: string;
  operation: "send" | "check";
  phone: string;
  ip: string;
  provider: "mock" | "twilio";
  resultCode: string;
  providerStatus?: string;
  providerRequestId?: string;
  metadata?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  const identifiers = await auditIdentifiers(phone, ip, env);
  const client = createServerSupabaseClient();
  const { error } = await client.rpc("record_phone_auth_audit", {
    p_request_id: requestId,
    p_operation: operation,
    p_phone_hash: identifiers.phoneHash,
    p_phone_masked: identifiers.phoneMasked,
    p_ip_hash: identifiers.ipHash,
    p_provider: provider,
    p_result_code: resultCode,
    p_provider_status: providerStatus ?? null,
    p_provider_request_id: providerRequestId ?? null,
    p_metadata: metadata,
  });
  if (error) throw new PhoneGuardrailError("guardrail_db_failed", `手机号审计写入失败：${error.message}`);
}
