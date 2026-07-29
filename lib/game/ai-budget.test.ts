import { describe, expect, it } from "vitest";
import { aiTurnsEnabled, getAiBudgetLimits } from "./ai-budget";

describe("AI daily budget configuration", () => {
  it("uses bounded production defaults", () => {
    expect(getAiBudgetLimits({})).toEqual({
      userDailyLimit: 40,
      globalDailyLimit: 500,
    });
  });

  it("rejects malformed and out-of-range values", () => {
    expect(getAiBudgetLimits({
      AI_DAILY_USER_LIMIT: "0",
      AI_DAILY_GLOBAL_LIMIT: "not-a-number",
    })).toEqual({
      userDailyLimit: 40,
      globalDailyLimit: 500,
    });
  });

  it("never lets the per-user allowance exceed the global allowance", () => {
    expect(getAiBudgetLimits({
      AI_DAILY_USER_LIMIT: "80",
      AI_DAILY_GLOBAL_LIMIT: "50",
    })).toEqual({
      userDailyLimit: 50,
      globalDailyLimit: 50,
    });
  });

  it("provides an explicit server-side emergency kill switch", () => {
    expect(aiTurnsEnabled({})).toBe(true);
    expect(aiTurnsEnabled({ AI_TURNS_ENABLED: " false " })).toBe(false);
  });
});
