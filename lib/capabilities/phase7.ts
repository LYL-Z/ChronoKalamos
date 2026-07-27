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
    id: "phone-auth",
    label: "中国大陆手机号辅助身份绑定",
    status: "evaluating",
    gates: [
      {
        id: "target-markets",
        label: "首发国家或地区清单",
        status: "missing",
        decision: "已选中国大陆；香港、澳门和台湾不在本次授权范围内。",
      },
      {
        id: "provider-account",
        label: "Twilio Verify 正式账号、Verify Service 与沙箱",
        status: "missing",
        decision: "已选 Twilio Verify；当前仅建立服务端适配，未证明中国短信送达。",
      },
      {
        id: "sender-registration",
        label: "中国短信送达、发送主体和本地资质",
        status: "missing",
        decision: "Twilio Verify 不等于中国本地送达许可；必须取得账号地理权限与合规结论。",
      },
      {
        id: "cost-controls",
        label: "发送预算、速率限制和异常停发阈值",
        status: "missing",
        decision: "采用 Verify 的服务级限制，并在应用层增加账号、IP 和预算闸门。",
      },
      {
        id: "captcha",
        label: "Cloudflare Turnstile 与自动化滥用防护",
        status: "missing",
        decision: "已选 Cloudflare Turnstile；站点密钥与服务端密钥尚未写入生产环境。",
      },
      {
        id: "recovery-policy",
        label: "换号、回收号码和账号恢复策略",
        status: "missing",
        decision: "已写入邮箱主恢复、号码回收、SIM swap 和人工恢复边界；安全通知与批准记录仍缺。",
      },
      {
        id: "phone-change-cleanup",
        label: "过期 phone_change 清理与冲突处理",
        status: "missing",
        decision: "已应用服务端预检迁移，拒绝跨用户冲突、覆盖和活动 phone_change；真实沙箱演练仍缺。",
      },
      {
        id: "sandbox-e2e",
        label: "同一 UUID 的游客升级与双用户隔离验收",
        status: "missing",
        decision: "仍未执行真实 Twilio Verify + Turnstile + Supabase Auth 端到端验收。",
      },
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

export const phase7ActiveTrackLabel = "中国大陆手机号辅助身份 · Twilio Verify + Turnstile 准备版";

export const phase7PublicIdentityStatus =
  "中国大陆手机号辅助身份：Twilio Verify 与 Cloudflare Turnstile 已锁定为接入方案，当前为公开准备版；手机号登录入口保持关闭，真实短信入口尚未启用。";

export const phase7PublicSupportStatus =
  "第 7 阶段当前只发布中国大陆手机号辅助身份的供应商准备层。Twilio Verify、Cloudflare Turnstile、送达权限、恢复政策和 Supabase 沙箱验收未全部完成；真实短信、微信、QQ 和支付仍保持关闭。";
