import { describe, expect, it } from "vitest";
import {
  canEnablePhase7Capability,
  collectPhase7PolicyViolations,
  phase7Capabilities,
} from "./phase7";

describe("phase 7 capability policy", () => {
  it("keeps exactly one capability under evaluation", () => {
    const active = phase7Capabilities.filter((capability) => capability.status !== "not_started");

    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("phone-auth");
    expect(active[0]?.status).toBe("evaluating");
  });

  it("does not allow phone auth before every gate has evidence", () => {
    const phoneAuth = phase7Capabilities.find((capability) => capability.id === "phone-auth");

    expect(phoneAuth).toBeDefined();
    expect(canEnablePhase7Capability(phoneAuth!)).toBe(false);
  });

  it("rejects simultaneous external capability work", () => {
    const invalid = phase7Capabilities.map((capability) => (
      capability.id === "wechat-auth"
        ? { ...capability, status: "evaluating" as const }
        : capability
    ));

    expect(collectPhase7PolicyViolations(invalid)).toContain(
      "阶段 7 同一时间只能推进一个外部能力。",
    );
  });
});
