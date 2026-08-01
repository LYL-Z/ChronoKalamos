import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 17 exposes world systems while preserving the authoritative turn boundary", async () => {
  const [registry, workbench, shell] = await Promise.all([
    read("lib/game/phase17-world.ts"),
    read("components/phase17-world-systems.tsx"),
    read("components/phase15-game-shell.tsx"),
  ]);

  for (const label of ["七阶层", "长安坊市", "天下十五道", "朝政", "内廷", "家户婚育", "物品目录", "结局档案"]) {
    assert.match(workbench, new RegExp(label));
  }
  assert.match(shell, /Phase17WorldSystems/);
  assert.match(shell, /aria-keyshortcuts="W"/);
  assert.match(registry, /最终结果仍由当前事件规则决定/);
  assert.doesNotMatch(registry, /supabase|fetch\(|insert\(|update\(|rpc\(/i);
  assert.doesNotMatch(workbench, /onSubmitAction|state\.[a-zA-Z]+\s*=/);
});

test("phase 17 copy states the catalogue and map limitations", async () => {
  const workbench = await read("components/phase17-world-systems.tsx");
  for (const boundary of [
    "不是唐代法定“七阶级”",
    "不是考古测绘图",
    "不采用贞观十道",
    "目录，不是 200 种独立历史器物",
    "可执行的规则路径",
    "写入权威 WorldState",
  ]) {
    assert.match(workbench, new RegExp(boundary));
  }
});

test("phase 17 settings have functional storage and document effects", async () => {
  const [settings, preferences, styles] = await Promise.all([
    read("app/settings/page.tsx"),
    read("lib/ui/preferences.ts"),
    read("app/globals.css"),
  ]);
  assert.match(settings, /界面密度/);
  assert.match(settings, /高对比档案/);
  assert.match(settings, /证据视图/);
  assert.match(preferences, /chronokalamos-density/);
  assert.match(preferences, /chronokalamos-high-contrast/);
  assert.match(preferences, /chronokalamos-evidence-default/);
  assert.match(styles, /html\[data-density="compact"\]/);
  assert.match(styles, /html\[data-contrast="high"\]/);
});
