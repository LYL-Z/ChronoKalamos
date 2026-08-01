import { describe, expect, it } from "vitest";
import { evaluateMatureContentReadiness } from "./phase16";

describe("phase 16 mature content gate", () => {
  it("defaults to disabled", () => {
    expect(evaluateMatureContentReadiness({})).toEqual({
      requested: false,
      publishable: false,
      violations: [],
    });
  });

  it("fails closed when any adult-content safeguard is missing", () => {
    const readiness = evaluateMatureContentReadiness({ MATURE_CONTENT_ENABLED: "true" });
    expect(readiness.publishable).toBe(false);
    expect(readiness.violations).toHaveLength(4);
  });

  it("reports readiness only when every server-side gate is explicit", () => {
    const readiness = evaluateMatureContentReadiness({
      MATURE_CONTENT_ENABLED: "true",
      MATURE_AGE_GATE_ENABLED: "true",
      MATURE_MINOR_EXCLUSION_REVIEWED: "true",
      MATURE_CONTENT_REVIEW_STATUS: "approved",
      MATURE_CONSENT_POLICY_VERSION: "mature-v1",
    });
    expect(readiness).toEqual({ requested: true, publishable: true, violations: [] });
  });
});
