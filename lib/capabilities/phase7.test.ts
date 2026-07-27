import { describe, expect, it } from "vitest";
import {
  canEnablePhase7Capability,
  collectPhase7PolicyViolations,
  phase7Capabilities,
} from "./phase7";

describe("phase 7 capability policy", () => {
  it("keeps exactly one capability enabled", () => {
    const active = phase7Capabilities.filter((capability) => capability.status !== "not_started");

    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("totp-mfa");
    expect(active[0]?.status).toBe("enabled");
  });

  it("allows TOTP after every gate has evidence", () => {
    const totp = phase7Capabilities.find((capability) => capability.id === "totp-mfa");

    expect(totp).toBeDefined();
    expect(canEnablePhase7Capability(totp!)).toBe(true);
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
