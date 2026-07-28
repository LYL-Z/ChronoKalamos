import type { SupabaseClient } from "@supabase/supabase-js";

export type TotpFactor = {
  id: string;
  friendlyName: string;
  status: "verified" | "unverified";
  createdAt: string;
};

export type TotpMfaSnapshot = {
  currentLevel: string | null;
  nextLevel: string | null;
  requiresChallenge: boolean;
  factors: TotpFactor[];
};

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function validatedTotpCode(code: string): string {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("请输入身份验证器生成的 6 位数字。");
  }
  return normalized;
}

export function totpQrCodeSource(qrCode: string): string {
  if (qrCode.startsWith("data:image/")) return qrCode;
  if (qrCode.trimStart().startsWith("<svg")) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(qrCode)}`;
  }
  return `data:image/svg+xml;utf-8,${qrCode}`;
}

export async function getTotpMfaSnapshot(
  client: SupabaseClient,
): Promise<TotpMfaSnapshot> {
  const [factorResult, assuranceResult] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (factorResult.error) throw factorResult.error;
  if (assuranceResult.error) throw assuranceResult.error;

  const factors = factorResult.data.all
    .filter((factor) => factor.factor_type === "totp")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name?.trim() || "身份验证器",
      status: factor.status,
      createdAt: factor.created_at,
    }))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const currentLevel = assuranceResult.data.currentLevel;
  const nextLevel = assuranceResult.data.nextLevel;

  return {
    currentLevel,
    nextLevel,
    requiresChallenge: currentLevel !== "aal2" && nextLevel === "aal2",
    factors,
  };
}

export async function startTotpEnrollment(
  client: SupabaseClient,
  friendlyName: string,
): Promise<TotpEnrollment> {
  const normalizedName = friendlyName.trim().slice(0, 48);
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: normalizedName || "ChronoKalamos 身份验证器",
    issuer: "ChronoKalamos",
  });

  if (error) throw error;

  return {
    factorId: data.id,
    qrCode: totpQrCodeSource(data.totp.qr_code),
    secret: data.totp.secret,
  };
}

export async function completeTotpChallenge(
  client: SupabaseClient,
  factorId: string,
  code: string,
): Promise<void> {
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code: validatedTotpCode(code),
  });
  if (error) throw error;
}

export async function removeTotpFactor(
  client: SupabaseClient,
  factorId: string,
): Promise<void> {
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
