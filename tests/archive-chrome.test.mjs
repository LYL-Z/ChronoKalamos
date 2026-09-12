import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("archive chrome unifies preferences, findability, and honest recovery", async () => {
  const [providers, chrome, preferences, page, settings, support, notFound, shell, evidence, styles, productShell] = await Promise.all([
    read("components/app-providers.tsx"),
    read("lib/ui/chrome.ts"),
    read("lib/ui/preferences.ts"),
    read("app/page.tsx"),
    read("app/settings/page.tsx"),
    read("app/support/page.tsx"),
    read("app/not-found.tsx"),
    read("components/phase15-game-shell.tsx"),
    read("components/evidence-map.tsx"),
    read("app/globals.css"),
    read("components/product-shell.tsx"),
  ]);
  const chromeSurface = `${providers}\n${chrome}`;

  assert.match(providers, /ProductPreferencesProvider/);
  assert.match(providers, /Ctrl/);
  assert.match(chromeSurface, /查找页面/);
  assert.match(providers, /ARCHIVE_FIND_EVENT/);
  assert.match(chromeSurface, /键位说明/);
  assert.match(chromeSurface, /聚焦选项，不自动提交/);
  assert.match(preferences, /ProductPreferencesProvider/);
  assert.match(preferences, /chronokalamos-skip-boot/);
  assert.match(page, /readInitialSkipBoot/);
  assert.match(page, /跳过启动/);
  assert.match(page, /event.key === "Escape"/);
  assert.match(page, /getChromeCopy/);
  assert.match(page, /BrandLockup/);
  assert.match(page, /PHASE14_PLAYTEST.editionLabel/);
  assert.match(page, /PHASE 11 · PUBLIC BETA/);
  assert.doesNotMatch(page, /PHASE 14/);
  assert.match(page, /className="map-column"[\s\S]*origin-deck[\s\S]*游客入口/);
  assert.match(settings, /跳过启动幕/);
  assert.match(support, /查找与键位/);
  assert.match(support, /史料记载/);
  assert.match(notFound, /这份档案不在当前切片里/);
  assert.match(shell, /variant="embedded"/);
  assert.match(shell, /1–5：聚焦选项，不自动提交/);
  assert.match(shell, /下一拍改到/);
  assert.match(evidence, /证据地点检索/);
  assert.match(evidence, /map-filter-advanced/);
  assert.match(evidence, /来源与等级/);
  assert.match(styles, /--type-caption: 0\.75rem/);
  assert.match(styles, /\.eyebrow \{[^}]*var\(--type-kicker\)/);
  assert.doesNotMatch(styles, /\.eyebrow \{[^}]*10px/);
  assert.match(evidence, /复制出处/);
  assert.match(evidence, /currentLocationId/);
  assert.match(styles, /archive-grain/);
  assert.match(styles, /html\[data-contrast="high"\] \.archive-grain/);
  assert.match(styles, /command-palette/);
  assert.match(page, /statusToast/);
  assert.match(shell, /个已发布证据地点/);
  assert.match(evidence, /feature\.published/);
  assert.match(preferences, /document.documentElement.lang = "zh-CN"/);
  assert.doesNotMatch(providers, /window\.addEventListener\("scroll"/);
  assert.match(productShell, /title="朱文印"/);
  assert.match(productShell, /PHASE14_PLAYTEST.editionLabel/);
  assert.match(shell, /title="朱文印"/);
  assert.match(shell, /权威事务回路 · 外部审阅待定/);
  assert.doesNotMatch(shell, /PHASE 18/);
  assert.match(shell, /className="phase15-more"/);
  assert.match(shell, />更多</);
});
