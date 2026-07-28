export type Phase7CapabilityId =
  | "totp-mfa"
  | "phone-auth"
  | "passkey-auth"
  | "wechat-auth"
  | "qq-auth"
  | "payments"
  | "second-scenario";

export type Phase7CapabilityStatus =
  | "not_started"
  | "evaluating"
  | "ready"
  | "enabled";

export type Phase7Gate = {
  id: string;
  label: string;
  status: "missing" | "verified";
  evidence?: string;
  decision?: string;
};

export type Phase7Capability = {
  id: Phase7CapabilityId;
  label: string;
  status: Phase7CapabilityStatus;
  gates: readonly Phase7Gate[];
};

export const phase7Capabilities = [
  {
    id: "totp-mfa",
    label: "邮箱账户 TOTP 二次验证",
    status: "enabled",
    gates: [
      {
        id: "email-boundary",
        label: "仅向已确认邮箱的正式账户开放",
        status: "verified",
        evidence: "components/identity-panel.tsx",
      },
      {
        id: "enrollment-challenge",
        label: "注册、挑战、验证和因子清理闭环",
        status: "verified",
        evidence: "lib/supabase/totp.ts; components/totp-mfa-panel.tsx",
      },
      {
        id: "aal2-database",
        label: "存档、回合与私有上传的 AAL2 数据库门禁",
        status: "verified",
        evidence: "Supabase migration phase7_totp_aal2; 7 restrictive policies",
      },
      {
        id: "recovery-boundary",
        label: "备用因子与管理员重置边界",
        status: "verified",
        evidence: "docs/totp-mfa.md",
      },
      {
        id: "live-e2e",
        label: "真实身份验证器注册、退出、再登录与 AAL2 隔离验收",
        status: "verified",
        evidence: "2026-07-27 用户报告公开站 TOTP 注册、退出、再登录与 AAL2 访问恢复通过；自动化双用户隔离测试通过。",
      },
    ],
  },
  {
    id: "phone-auth",
    label: "短信与手机号登录（暂缓）",
    status: "not_started",
    gates: [],
  },
  {
    id: "passkey-auth",
    label: "Passkey（暂缓）",
    status: "not_started",
    gates: [],
  },
  { id: "wechat-auth", label: "微信登录", status: "not_started", gates: [] },
  { id: "qq-auth", label: "QQ 登录", status: "not_started", gates: [] },
  { id: "payments", label: "真实打赏", status: "not_started", gates: [] },
  { id: "second-scenario", label: "第二历史场景", status: "not_started", gates: [] },
] as const satisfies readonly Phase7Capability[];

export function canEnablePhase7Capability(capability: Phase7Capability): boolean {
  return capability.gates.length > 0
    && capability.gates.every((gate) => gate.status === "verified" && Boolean(gate.evidence?.trim()));
}

export function collectPhase7PolicyViolations(
  capabilities: readonly Phase7Capability[],
): string[] {
  const violations: string[] = [];
  const active = capabilities.filter((capability) => capability.status !== "not_started");

  if (active.length > 1) {
    violations.push("阶段 7 同一时间只能推进一个外部能力。");
  }

  for (const capability of capabilities) {
    if (
      (capability.status === "ready" || capability.status === "enabled")
      && !canEnablePhase7Capability(capability)
    ) {
      violations.push(`${capability.label} 缺少可审计的启用证据。`);
    }
  }

  return violations;
}

export function assertPhase7Policy(
  capabilities: readonly Phase7Capability[] = phase7Capabilities,
): void {
  const violations = collectPhase7PolicyViolations(capabilities);
  if (violations.length > 0) throw new Error(violations.join(" "));
}

assertPhase7Policy();

export const phase7ActiveTrackLabel = "邮箱 + TOTP 免费身份防护 · AAL2 已启用";

export const phase7PublicIdentityStatus =
  "免费身份方案已启用：邮箱登录继续开放；正式账户可配置 TOTP 身份验证器。短信、手机号登录和 Passkey 暂不接入。已启用 TOTP 的账户必须完成二次验证，才能访问存档与私有上传。";

export const phase7PublicSupportStatus =
  "阶段 7 当前只启用免费 TOTP。数据库 AAL2 门禁、真实身份验证器人工验收和双用户自动化隔离均已通过；短信、手机号登录、Passkey、微信、QQ 和支付均保持关闭。";
