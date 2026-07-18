import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/page.tsx", import.meta.url);
const layout = new URL("../app/layout.tsx", import.meta.url);
const identityPanel = new URL("../components/identity-panel.tsx", import.meta.url);

test("ChronoKalamos prototype keeps the evidence-bound core visible", async () => {
  const [pageSource, layoutSource, identitySource] = await Promise.all([
    readFile(page, "utf8"),
    readFile(layout, "utf8"),
    readFile(identityPanel, "utf8"),
  ]);

  assert.match(pageSource, /历史总是对我紧追不舍/);
  assert.match(pageSource, /742 CE/);
  assert.match(pageSource, /史料记载|合理重建|叙事虚构/);
  assert.match(pageSource, /prefers-reduced-motion|low-motion/);
  assert.match(pageSource, /chronokalamos-locale/);
  assert.match(pageSource, /aria-describedby="setup-description"/);
  assert.match(pageSource, /event.key === "Escape"/);
  assert.match(pageSource, /value: "zh"/);
  assert.match(pageSource, /value: "en"/);
  assert.match(pageSource, /value: "fr"/);
  assert.match(pageSource, /value: "el"/);
  assert.match(pageSource, /value: "ru"/);
  assert.match(identitySource, /微信、QQ、手机号/);
  assert.match(identitySource, /Supabase 未配置/);
  assert.doesNotMatch(pageSource, /SkeletonPreview|codex-preview/);
  assert.match(layoutSource, /ChronoKalamos/);
  assert.match(layoutSource, /zh-CN/);
});
