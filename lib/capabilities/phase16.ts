export type MatureContentReadiness = {
  requested: boolean;
  publishable: boolean;
  violations: string[];
};

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function evaluateMatureContentReadiness(
  env: Record<string, string | undefined>,
): MatureContentReadiness {
  const requested = enabled(env.MATURE_CONTENT_ENABLED);
  if (!requested) return { requested: false, publishable: false, violations: [] };

  const violations: string[] = [];
  if (!enabled(env.MATURE_AGE_GATE_ENABLED)) violations.push("缺少独立年龄门禁。");
  if (!enabled(env.MATURE_MINOR_EXCLUSION_REVIEWED)) violations.push("未完成未成年人排除审查。");
  if (env.MATURE_CONTENT_REVIEW_STATUS !== "approved") violations.push("内容安全审查尚未批准。");
  if (!env.MATURE_CONSENT_POLICY_VERSION?.trim()) violations.push("缺少可追溯的同意政策版本。");

  return {
    requested,
    publishable: violations.length === 0,
    violations,
  };
}

export const phase16PublicMatureContentStatus =
  "当前公开版保持 16+。成人内容、露骨性内容与相关玩法均未启用。";
