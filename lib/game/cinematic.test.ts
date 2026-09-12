import { describe, expect, it } from "vitest";
import { phase11Content } from "@/lib/historical/phase11";
import { getPublishedCinematicScene } from "./cinematic";

describe("phase 11 cinematic adapter", () => {
  it("keeps the authored phase 10 title cards", () => {
    expect(getPublishedCinematicScene("merchant-ledger-mark")?.titleCard).toBe("纸面留下了一个口子");
    expect(getPublishedCinematicScene("merchant-ledger-mark")?.shot).toBe("threshold");
  });

  it("covers every phase 11 event with a live shot the shell can render", () => {
    expect(phase11Content.events).toHaveLength(27);
    for (const event of phase11Content.events) {
      const scene = getPublishedCinematicScene(event.eventId);
      expect(scene, event.eventId).not.toBeNull();
      expect(["threshold", "tabletop", "corridor"]).toContain(scene?.shot);
      expect(scene?.voiceLine.classification).toBe("叙事虚构");
      expect(scene?.voiceLine.text.length).toBeGreaterThan(8);
    }
  });
});
