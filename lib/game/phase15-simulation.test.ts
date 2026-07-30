import { describe, expect, it } from "vitest";
import {
  getChoiceDisclosure,
  getDayCycleState,
  getModuleDescriptors,
  getSocialPosition,
} from "./phase15-simulation";
import { createInitialWorldState, normalizeWorldState } from "./rules";

describe("phase 15 archive simulation contracts", () => {
  it("upgrades legacy saves with bounded energy and morale defaults", () => {
    const current = createInitialWorldState("merchant");
    const legacy: Record<string, unknown> = { ...current };
    delete legacy.energy;
    delete legacy.morale;
    const upgraded = normalizeWorldState(legacy, "merchant");

    expect(upgraded.energy).toEqual({ current: 3, max: 3 });
    expect(upgraded.morale).toBe(6);
    expect(upgraded.story.currentEventId).toBe(current.story.currentEventId);
  });

  it("describes the three-action day without inventing a second transaction", () => {
    const state = createInitialWorldState("craft");
    expect(getDayCycleState(state)).toMatchObject({
      dayIndex: 1,
      usedSlots: 0,
      remainingSlots: 3,
      closesAfterNextAction: false,
    });

    const afterTwo = {
      ...state,
      time: { ...state.time, turn: 2 },
      energy: { current: 1 as const, max: 3 as const },
    };
    expect(getDayCycleState(afterTwo)).toMatchObject({
      dayIndex: 1,
      usedSlots: 2,
      remainingSlots: 1,
      closesAfterNextAction: true,
    });
  });

  it("keeps clerk authority below the official stratum", () => {
    const clerk = getSocialPosition(createInitialWorldState("clerk"));
    expect(clerk.stratum).toBe("胥吏");
    expect(clerk.evidenceBoundary).toContain("不等于品官");
  });

  it("backs all seven modules with current state instead of placeholder features", () => {
    const modules = getModuleDescriptors(createInitialWorldState("merchant"));
    expect(modules).toHaveLength(7);
    expect(modules.map((module) => module.id)).toEqual([
      "map",
      "attributes",
      "inventory",
      "relations",
      "livelihood",
      "quests",
      "household",
    ]);
    expect(modules.find((module) => module.id === "inventory")?.empty).toBe(true);
  });

  it("discloses direction and cost without leaking the hidden consequence graph", () => {
    const state = createInitialWorldState("merchant");
    const disclosure = getChoiceDisclosure(state, "choice-1", "11.0.0");
    expect(disclosure.actionSlots).toBe(1);
    expect(disclosure.minutes).toBeGreaterThanOrEqual(5);
    expect(disclosure.note).toContain("不展示隐藏事件");
    expect(disclosure).not.toHaveProperty("nextEventId");
    expect(disclosure).not.toHaveProperty("consequenceKey");
  });
});
