import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/page.tsx", import.meta.url);
const layout = new URL("../app/layout.tsx", import.meta.url);
const identityPanel = new URL("../components/identity-panel.tsx", import.meta.url);
const historicalClient = new URL("../lib/supabase/historical.ts", import.meta.url);
const phase7Capabilities = new URL("../lib/capabilities/phase7.ts", import.meta.url);
const evidenceMap = new URL("../components/evidence-map.tsx", import.meta.url);
const preferences = new URL("../lib/ui/preferences.ts", import.meta.url);
const styles = new URL("../app/globals.css", import.meta.url);

test("ChronoKalamos prototype keeps the evidence-bound core visible", async () => {
  const [pageSource, layoutSource, identitySource, historicalSource, phase7Source, evidenceSource, preferencesSource, stylesSource] = await Promise.all([
    readFile(page, "utf8"),
    readFile(layout, "utf8"),
    readFile(identityPanel, "utf8"),
    readFile(historicalClient, "utf8"),
    readFile(phase7Capabilities, "utf8"),
    readFile(evidenceMap, "utf8"),
    readFile(preferences, "utf8"),
    readFile(styles, "utf8"),
  ]);

  assert.match(evidenceSource, /历史总是对我紧追不舍/);
  assert.match(evidenceSource, /742 CE/);
  assert.match(evidenceSource, /史料记载|合理重建|叙事虚构/);
  assert.match(stylesSource, /prefers-reduced-motion|low-motion/);
  assert.match(preferencesSource, /chronokalamos-locale/);
  assert.match(pageSource, /aria-describedby="setup-description"/);
  assert.match(pageSource, /event.key === "Escape"/);
  assert.match(pageSource, /value: "zh"/);
  assert.match(pageSource, /value: "en"/);
  assert.match(pageSource, /value: "fr"/);
  assert.match(pageSource, /value: "el"/);
  assert.match(pageSource, /value: "ru"/);
  assert.match(phase7Source, /微信、QQ/);
  assert.match(phase7Source, /手机号登录/);
  assert.match(identitySource, /Supabase 未配置/);
  assert.match(identitySource, /真实 Supabase Auth/);
  assert.match(identitySource, /密码登录/);
  assert.match(identitySource, /data-testid="identity-email-form"/);
  assert.match(evidenceSource, /SUPABASE \/ PUBLISHED MIRROR/);
  assert.match(pageSource, /loadPublishedChanganContent/);
  assert.match(historicalSource, /from\("historical_origins"\)/);
  assert.match(historicalSource, /validateChanganContent/);
  assert.doesNotMatch(pageSource, /SkeletonPreview|codex-preview/);
  assert.match(layoutSource, /ChronoKalamos/);
  assert.match(layoutSource, /zh-CN/);
});
