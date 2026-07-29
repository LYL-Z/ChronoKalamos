import { describe, expect, it } from "vitest";
import {
  phase11Content,
  validatePhase11Content,
} from "@/lib/historical/phase11";
import {
  phase11CandidateEventTemplates,
  phase11CandidateManifest,
} from "@/lib/game/phase11-catalog";
import {
  phase11CitationLinks,
  phase11CitationMetrics,
} from "@/lib/historical/phase11-citations";
import { phase11CinematicScenes } from "@/lib/historical/phase11-cinematic";

describe("phase 11 Chang'an candidate content", () => {
  it("contains three nine-event chapters and twelve functional NPCs", () => {
    expect(phase11Content.chapters).toHaveLength(3);
    expect(phase11Content.events).toHaveLength(27);
    expect(phase11Content.npcs).toHaveLength(12);
    expect(phase11Content.items).toHaveLength(9);
    expect(phase11Content.risks).toHaveLength(6);
    expect(phase11Content.voiceLines).toHaveLength(27);
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
      phase11CandidateEventTemplates.every(
        (event) =>
          event.publicationStatus === "provisional"
          && event.runtimeAvailability === "public-beta",
      ),
    ).toBe(true);
  });

  it("allows public-beta play without claiming external historical certification", () => {
    expect(phase11Content.gate.reviewStatus).toBe("pending");
    expect(phase11Content.gate.reviewers).toEqual([]);
    expect(phase11Content.gate.releaseMode).toBe("public-beta-unreviewed");
    expect(phase11Content.gate.historicalCertificationClaimed).toBe(false);
    expect(phase11Content.gate.publicRuntimeEnabled).toBe(true);
    expect(phase11Content.gate.publicDisclaimerZh).toContain("未经外部历史学家认证");

    const invalid = {
      ...phase11Content,
      gate: {
        ...phase11Content.gate,
        reviewStatus: "approved",
        historicalCertificationClaimed: true,
      },
    };
    expect(() => validatePhase11Content(invalid)).toThrow(/expected false|certification/);
  });

  it("does not attach historical source IDs to fictional NPC identities", () => {
    expect(
      phase11Content.npcs.every(
        (npc) => npc.classification === "叙事虚构" && npc.sourceIds.length === 0,
      ),
    ).toBe(true);
  });

  it("keeps exactly one captioned fictional voice line for every candidate event", () => {
    expect(new Set(phase11Content.voiceLines.map((line) => line.eventId)).size).toBe(27);
    expect(
      phase11Content.voiceLines.every(
        (line) =>
          line.classification === "叙事虚构"
          && line.language === "zh-CN"
          && line.publicationStatus === "provisional",
      ),
    ).toBe(true);
  });

  it("builds 100 traceable event-to-source links without calling them 100 unique works", () => {
    expect(phase11CitationLinks).toHaveLength(100);
    expect(phase11CitationMetrics.linkCount).toBe(100);
    expect(phase11CitationMetrics.uniqueSourceCount).toBe(11);
    expect(phase11CitationMetrics.eventCount).toBe(27);
    expect(
      phase11CitationMetrics.byScope.eventContext
      + phase11CitationMetrics.byScope.claimSupport
      + phase11CitationMetrics.byScope.sceneSetting,
    ).toBe(100);
  });

  it("defines 27 cinematic scenes with opt-in synthetic voice and mandatory captions", () => {
    expect(phase11CinematicScenes).toHaveLength(27);
    expect(
      phase11CinematicScenes.every(
        (scene) =>
          scene.classification === "叙事虚构"
          && scene.audioPolicy.autoplay === false
          && scene.audioPolicy.captionsRequired === true
          && scene.audioPolicy.syntheticVoice === "device-only"
          && scene.audioPolicy.historicalPronunciationClaim === false
          && scene.evidenceLinkIds.length >= 3,
      ),
    ).toBe(true);
  });
});
