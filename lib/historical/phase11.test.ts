import { describe, expect, it } from "vitest";
import {
  phase11Content,
  validatePhase11Content,
} from "@/lib/historical/phase11";
import {
  phase11CandidateEventTemplates,
  phase11CandidateManifest,
} from "@/lib/game/phase11-catalog";

describe("phase 11 Chang'an candidate content", () => {
  it("contains three nine-event chapters and twelve functional NPCs", () => {
    expect(phase11Content.chapters).toHaveLength(3);
    expect(phase11Content.events).toHaveLength(27);
    expect(phase11Content.npcs).toHaveLength(12);
    expect(phase11Content.items).toHaveLength(9);
    expect(phase11Content.risks).toHaveLength(6);
    expect(phase11Content.chapters.every((chapter) => chapter.eventIds.length === 9)).toBe(true);
    expect(phase11Content.events.filter((event) => event.phase === "consequence")).toHaveLength(6);
    expect(phase11Content.events.filter((event) => event.phase === "ending")).toHaveLength(3);
  });

  it("compiles the editor beats into 27 runtime-valid templates with 81 choices", () => {
    expect(phase11CandidateManifest.contentVersion).toBe("11.0.0");
    expect(phase11CandidateManifest.locations).toHaveLength(8);
    expect(phase11CandidateEventTemplates).toHaveLength(27);
    expect(
      phase11CandidateEventTemplates.reduce((sum, event) => sum + event.choices.length, 0),
    ).toBe(81);
    expect(
      phase11CandidateEventTemplates.every((event) => event.publicationStatus === "provisional"),
    ).toBe(true);
  });

  it("keeps the public runtime disabled until an actual external review exists", () => {
    expect(phase11Content.gate.reviewStatus).toBe("pending");
    expect(phase11Content.gate.reviewers).toEqual([]);
    expect(phase11Content.gate.publicRuntimeEnabled).toBe(false);

    const invalid = {
      ...phase11Content,
      gate: {
        ...phase11Content.gate,
        reviewStatus: "approved",
        publicRuntimeEnabled: true,
      },
    };
    expect(() => validatePhase11Content(invalid)).toThrow(/real external review/);
  });

  it("does not attach historical source IDs to fictional NPC identities", () => {
    expect(
      phase11Content.npcs.every(
        (npc) => npc.classification === "叙事虚构" && npc.sourceIds.length === 0,
      ),
    ).toBe(true);
  });
});
