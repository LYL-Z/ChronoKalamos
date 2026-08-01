import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "./rules";
import {
  canUsePhase17Action,
  getPhase17Stratum,
  phase17ChanganCells,
  phase17Circuits,
  phase17Endings,
  phase17ItemCatalog,
  phase17Scale,
  phase17Strata,
  phase17SystemActions,
  phase17Wards,
} from "./phase17-world";

const validSources = new Set(Array.from({ length: 18 }, (_, index) => `S-${String(index + 1).padStart(3, "0")}`));

describe("phase 17 world registries", () => {
  it("freezes the requested scale without hiding the evidence boundary", () => {
    expect(phase17Scale).toMatchObject({ strata: 7, wards: 108, changanCells: 110, circuits: 15, items: 200, endings: 50 });
    expect(new Set(phase17Wards.map((ward) => ward.id))).toHaveLength(108);
    expect(phase17ChanganCells.filter((cell) => cell.kind === "market")).toHaveLength(2);
    expect(phase17Wards.every((ward) => ward.evidenceStatus === "index-only")).toBe(true);
    expect(phase17Wards.every((ward) => ward.classification === "合理重建")).toBe(true);
    expect(phase17Wards.every((ward) => ward.uncertaintyNote.length > 15)).toBe(true);
  });

  it("uses the 742 fifteen-circuit register rather than a ten-circuit shortcut", () => {
    expect(phase17Circuits.map((entry) => entry.name)).toEqual([
      "京畿道", "关内道", "都畿道", "河南道", "河东道", "河北道", "陇右道", "山南东道",
      "山南西道", "淮南道", "江南东道", "江南西道", "黔中道", "剑南道", "岭南道",
    ]);
  });

  it("keeps all bulk content provisional and source-addressable", () => {
    const records = [...phase17ItemCatalog, ...phase17Endings];
    expect(new Set(phase17ItemCatalog.map((item) => item.id))).toHaveLength(200);
    expect(new Set(phase17Endings.map((ending) => ending.id))).toHaveLength(50);
    expect(records.every((record) => record.publicationStatus === "provisional")).toBe(true);
    expect(phase17Endings.every((ending) => ending.classification === "叙事虚构")).toBe(true);
    expect(records.flatMap((record) => record.sourceIds).every((sourceId) => validSources.has(sourceId))).toBe(true);
  });

  it("derives access from committed state and never mutates it", () => {
    const state = createInitialWorldState("clerk");
    const snapshot = structuredClone(state);
    expect(getPhase17Stratum(state).id).toBe("subofficial");
    expect(canUsePhase17Action(state, phase17SystemActions.find((action) => action.id === "document-collation")!).allowed).toBe(true);
    expect(canUsePhase17Action(state, phase17SystemActions.find((action) => action.id === "personnel-docket")!)).toMatchObject({ allowed: false });
    expect(state).toEqual(snapshot);
  });

  it("only unlocks higher access through completed editor-owned quests", () => {
    const state = createInitialWorldState("merchant");
    state.quests.push({ id: "stratum-official-appointed", label: "已由事件授官", status: "completed" });
    expect(getPhase17Stratum(state).id).toBe("ranked-official");
    state.death = { cause: "测试退场", trigger: "测试", classification: "叙事虚构" };
    expect(canUsePhase17Action(state, phase17SystemActions[0])).toEqual({ allowed: false, reason: "角色已死亡。" });
  });

  it("describes seven permission tiers, not a fabricated historical caste law", () => {
    expect(phase17Strata).toHaveLength(7);
    expect(phase17Strata.every((entry, index) => entry.level === index + 1)).toBe(true);
    expect(phase17Strata.every((entry) => entry.exclusions.length > 0 && entry.sourceIds.length > 0)).toBe(true);
  });
});
