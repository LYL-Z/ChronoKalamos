import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "@/lib/game/rules";
import { phase17Endings } from "@/lib/game/phase17-world";
import {
  applyAuthoritativeSystemAction,
  buildPhase18ReachabilityPlan,
  executePhase18ReachabilityPlan,
  getPhase18EndingEligibility,
  phase18ActionCatalog,
} from "@/lib/game/phase18-authority";

function actionId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("Phase 18 authoritative world systems", () => {
  it("binds every action to evidence context and a bounded domain", () => {
    expect(phase18ActionCatalog).toHaveLength(20);
    expect(new Set(phase18ActionCatalog.map((entry) => entry.id)).size).toBe(20);
    expect(phase18ActionCatalog.every((entry) => entry.sourceIds.length > 0)).toBe(true);
    expect(new Set(phase18ActionCatalog.map((entry) => entry.classification))).toEqual(
      new Set(["合理重建", "叙事虚构"]),
    );
  });

  it("rejects marriage without confirmed adult age and explicit mutual consent", () => {
    const state = createInitialWorldState("merchant");
    expect(() => applyAuthoritativeSystemAction(state, {
      clientActionId: actionId(1),
      expectedStateVersion: 0,
      actionId: "marriage-contract",
      approach: "prudent",
      parameters: { partnerLabel: "某甲", partnerAge: 20, mutualConsent: true },
    })).toThrow("actor_adulthood_unconfirmed");
  });

  it("commits household, case, office, trade, elite and governance into WorldState", () => {
    let state = createInitialWorldState("merchant");
    const run = (actionIdValue: Parameters<typeof applyAuthoritativeSystemAction>[1]["actionId"], parameters: Parameters<typeof applyAuthoritativeSystemAction>[1]["parameters"] = {}) => {
      state = applyAuthoritativeSystemAction(state, {
        clientActionId: actionId(state.time.turn + 1),
        expectedStateVersion: state.time.turn,
        actionId: actionIdValue,
        approach: "prudent",
        parameters,
      }).nextState;
    };
    run("confirm-adult-age", { actorAge: 22 });
    run("household-care");
    run("marriage-contract", { partnerLabel: "婚约对象（架空）", partnerAge: 21, mutualConsent: true });
    run("register-child-care", { childLabel: "受照护子女（架空）", childAge: 2 });
    run("study-records");
    run("study-records");
    run("case-open");
    run("case-investigate");
    run("case-resolve");
    run("office-appoint");
    run("office-duty");
    run("trade-buy", { itemId: "p17-flatbread-ration" });
    run("trade-sell", { itemId: "p17-flatbread-ration" });
    run("household-care");
    run("elite-introduction");
    run("elite-council");
    run("governance-accession");
    run("governance-relief", { circuitId: "capital" });

    expect(state.systems.household.marriageStatus).toBe("contracted");
    expect(state.systems.household.children).toBe(1);
    expect(state.systems.casework.resolvedCount).toBe(1);
    expect(state.systems.office.appointment?.classification).toBe("叙事虚构");
    expect(state.systems.commerce.completedTrades).toBe(2);
    expect(state.systems.eliteNetwork.councilAccess).toBe(true);
    expect(state.systems.governance.access).toBe(true);
    expect(state.systems.governance.reviewedCircuits).toContain("capital");
  });

  it.each(phase17Endings.map((ending) => [ending.id, ending.title]))(
    "proves ending %s (%s) reachable through deterministic actions",
    (endingId) => {
      const plan = buildPhase18ReachabilityPlan(endingId);
      expect(plan.length).toBeGreaterThanOrEqual(3);
      const finalState = executePhase18ReachabilityPlan(createInitialWorldState("merchant"), endingId);
      expect(getPhase18EndingEligibility(finalState, endingId).eligible).toBe(true);
      expect(finalState.systems.activeEndingId).toBe(endingId);
      expect(finalState.story.chapterEnding?.id).toBe(endingId);
    },
  );
});
