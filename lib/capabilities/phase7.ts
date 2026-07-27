export type Phase7CapabilityId =
  | "phone-auth"
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
};

export type Phase7Capability = {
  id: Phase7CapabilityId;
  label: string;
  status: Phase7CapabilityStatus;
  gates: readonly Phase7Gate[];
};

export const phase7Capabilities = [
  {
    id: "phone-auth",
    label: "手机号登录",
    status: "evaluating",
    gates: [
      { id: "target-markets", label: "首发国家或地区清单", status: "missing" },
      { id: "provider-account", label: "短信供应商正式账号与沙箱", status: "missing" },
      { id: "sender-registration", label: "发送主体、模板和当地资质", status: "missing" },
      { id: "cost-controls", label: "发送预算、速率限制和异常停发阈值", status: "missing" },
      { id: "captcha", label: "CAPTCHA 与自动化滥用防护", status: "missing" },
      { id: "recovery-policy", label: "换号、回收号码和账号恢复策略", status: "missing" },
      { id: "phone-change-cleanup", label: "过期 phone_change 清理与冲突处理", status: "missing" },
      { id: "sandbox-e2e", label: "同一 UUID 的游客升级与双用户隔离验收", status: "missing" },
    ],
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

export const phase7ActiveTrackLabel = "手机号登录评估 · 尚未启用";

export const phase7PublicIdentityStatus =
  "手机号登录：第 7 阶段评估中，短信供应商、目标地区、反滥用和恢复规则未就绪；微信、QQ 仍未启动。";

export const phase7PublicSupportStatus =
  "第 7 阶段仅评估手机号登录。真实短信、微信、QQ 和支付仍保持关闭；未完成供应商、政策与沙箱验收前不会显示可用入口。";
