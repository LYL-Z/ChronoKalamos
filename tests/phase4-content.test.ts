import { describe, expect, it } from "vitest";
import { changanContent, validateChanganContent } from "@/lib/historical/content";

describe("742 Chang'an content boundary", () => {
  it("loads the bounded package with three published origins and eight evidence map features", () => {
    expect(changanContent.scenarioId).toBe("tang-changan-742");
    expect(changanContent.year).toBe(742);
    expect(changanContent.origins).toHaveLength(3);
    expect(changanContent.mapFeatures).toHaveLength(8);
    expect(changanContent.claims).toHaveLength(40);
    expect(changanContent.claims.filter((claim) => claim.published)).toHaveLength(13);
    expect(changanContent.claims.filter((claim) => claim.publicationStatus === "provisional")).toHaveLength(27);
    expect(changanContent.mapFeatures.filter((feature) => feature.published)).toHaveLength(5);
    expect(changanContent.mapFeatures.filter((feature) => feature.publicationStatus === "provisional")).toHaveLength(3);
  });

  it("rejects a published factual claim without a source", () => {
    const claims = changanContent.claims.map((claim) => ({ ...claim }));
    claims[0] = { ...claims[0], sourceIds: [] };
    expect(() => validateChanganContent({
      sources: changanContent.sources,
      claims,
      origins: changanContent.origins,
      mapFeatures: changanContent.mapFeatures,
    })).toThrow(/without a source/);
  });

  it("rejects a map feature that hides its uncertainty or license", () => {
    const mapFeatures = changanContent.mapFeatures.map((feature) => ({ ...feature }));
    mapFeatures[0] = { ...mapFeatures[0], uncertaintyNoteZh: "", attribution: "" };
    expect(() => validateChanganContent({
      sources: changanContent.sources,
      claims: changanContent.claims,
      origins: changanContent.origins,
      mapFeatures,
    })).toThrow(/missing map license attribution/);
  });
});
