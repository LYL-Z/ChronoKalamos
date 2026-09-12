import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getPublishedCinematicScene } from "@/lib/game/cinematic";
import { getModuleDescriptors } from "@/lib/game/phase15-simulation";
import { createInitialWorldState } from "@/lib/game/rules";
import { changanContent, publishedMapFeatureCount } from "@/lib/historical/content";
import { phase11Content } from "@/lib/historical/phase11";
import { PHASE14_PLAYTEST } from "@/lib/playtest/config";
import release from "@/lib/playtest/release.json";
import { matchesDeclaredImageMagic } from "@/lib/supabase/uploads";

async function readRepo(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("cross-file product invariants", () => {
  it("keeps playtest release identity identical across runtime, SQL, protocol, and scripts", async () => {
    expect(PHASE14_PLAYTEST.appRelease).toBe(release.appRelease);
    expect(PHASE14_PLAYTEST.contentVersion).toBe(release.contentVersion);
    expect(PHASE14_PLAYTEST.scenarioId).toBe("tang-changan-742");

    const migrations = (await readdir(new URL("../../supabase/migrations", import.meta.url)))
      .filter((name) => name.includes("phase14_playtest_release_"))
      .sort();
    const latestReleaseMigration = migrations.at(-1);
    expect(latestReleaseMigration).toBeTruthy();

    const [sql, protocol, cleanup, report, live] = await Promise.all([
      readRepo(`supabase/migrations/${latestReleaseMigration}`),
      readRepo("docs/playtest-protocol.md"),
      readRepo("scripts/cleanup-phase14-playtest.mjs"),
      readRepo("scripts/report-phase14-playtest.mjs"),
      readRepo("tests/supabase-live.test.mjs"),
    ]);

    expect(sql).toContain(`check (app_release = '${release.appRelease}')`);
    expect(protocol).toContain(`发布版本为 \`${release.appRelease}\``);
    expect(protocol).toContain(`内容版本为 \`${release.contentVersion}\``);
    expect(cleanup).toContain("lib/playtest/release.json");
    expect(cleanup).toContain("release.appRelease");
    expect(report).toContain("lib/playtest/release.json");
    expect(report).toContain("release.appRelease");
    expect(live).toContain("lib/playtest/release.json");
    expect(live).toContain("release.appRelease");
    expect(live).not.toMatch(/app_release:\s*"(36|40)"/);
  });

  it("keeps published HUD counts identical to the local evidence pack", () => {
    const publishedFeatures = changanContent.mapFeatures.filter((feature) => feature.published);
    const publishedClaims = changanContent.claims.filter((claim) => claim.published);
    const publishedOrigins = changanContent.origins.filter((origin) => origin.published);
    const modules = getModuleDescriptors(createInitialWorldState("merchant"));
    const map = modules.find((module) => module.id === "map");

    expect(publishedFeatures).toHaveLength(5);
    expect(publishedMapFeatureCount).toBe(publishedFeatures.length);
    expect(map?.count).toBe(publishedFeatures.length);
    expect(publishedFeatures.every((feature) => feature.sourceIds.length > 0)).toBe(true);
    expect(publishedOrigins).toHaveLength(3);
    expect(publishedClaims).toHaveLength(13);
    expect(
      publishedClaims
        .filter((claim) => claim.classification !== "叙事虚构")
        .every((claim) => claim.sourceIds.length > 0),
    ).toBe(true);
  });

  it("covers every chapter event with a renderable cinematic shot", () => {
    expect(phase11Content.events).toHaveLength(27);
    expect(phase11Content.events.every((event) => getPublishedCinematicScene(event.eventId))).toBe(true);
  });

  it("publishes one product edition and keeps PHASE 11 as content certification, not a competing product version", async () => {
    const [page, productShell, gameShell, world] = await Promise.all([
      readRepo("app/page.tsx"),
      readRepo("components/product-shell.tsx"),
      readRepo("components/phase15-game-shell.tsx"),
      readRepo("components/phase17-world-systems.tsx"),
    ]);

    expect(PHASE14_PLAYTEST.editionLabel).toBe(release.editionLabel);
    expect(page).toContain("PHASE14_PLAYTEST.editionLabel");
    expect(page).toContain("PHASE 11 · PUBLIC BETA");
    expect(page).toContain("公开版 16+");
    expect(page).not.toMatch(/PHASE 14/);
    expect(page).not.toMatch(/阶段 7 \/ 7/);
    expect(productShell).toContain("PHASE14_PLAYTEST.editionLabel");
    expect(productShell).not.toMatch(/PHASE 14/);
    expect(gameShell).toContain("权威事务回路 · 外部审阅待定");
    expect(gameShell).not.toMatch(/PHASE 18/);
    expect(world).toContain("AUTHORITATIVE TRANSACTION");
    expect(world).not.toMatch(/PHASE 18/);
  });

  it("rejects a PNG declared as JPEG before any storage write", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(matchesDeclaredImageMagic(png, "image/png")).toBe(true);
    expect(matchesDeclaredImageMagic(png, "image/jpeg")).toBe(false);
  });
});
