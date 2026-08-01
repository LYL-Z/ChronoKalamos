import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "./rules";
import {
  getPhase16Cycle,
  getPhase16Progression,
  getPhase16SettlementChanges,
} from "./phase16-progression";

describe("phase 16 gameplay progression", () => {
  it("derives a ten-day simulation cycle without adding a second clock", () => {
    const state = createInitialWorldState("merchant");
    state.time.turn = 30;
    expect(getPhase16Cycle(state)).toEqual({
      dayIndex: 11,
      xunIndex: 2,
      dayWithinXun: 1,
      completedDays: 10,
      label: "模拟旬期 2 · 第 1/10 日",
    });
  });

  it("keeps goals and achievements derived from committed world state", () => {
    const state = createInitialWorldState("craft");
    state.time.turn = 3;
    state.story.completedEventIds = ["craft-measurement-dispute"];
    const progression = getPhase16Progression(state, "11.0.0");

    expect(progression.totalOriginEvents).toBe(9);
    expect(progression.goals).toHaveLength(3);
    expect(progression.achievements.find((entry) => entry.id === "day-closed")?.unlocked).toBe(true);
    expect(progression.completedGoals).toBe(0);
  });

  it("reports every committed state delta with risk using inverse tone", () => {
    const before = createInitialWorldState("clerk");
    const after = structuredClone(before);
    after.money.cash -= 5;
    after.morale += 1;
    after.story.riskClocks = [{
      id: "dispatch-error",
      label: "文书误递风险",
      progress: 2,
      threshold: 5,
      status: "active",
    }];

    const changes = getPhase16SettlementChanges(before, after);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "money", delta: -5, tone: "negative" }),
      expect.objectContaining({ id: "morale", delta: 1, tone: "positive" }),
      expect.objectContaining({ id: "risk", delta: 2, tone: "negative" }),
    ]));
  });
});
