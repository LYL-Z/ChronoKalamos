import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 15 exposes seven real archive modules and a bounded action docket", async () => {
  const [shell, simulation] = await Promise.all([
    read("components/phase15-game-shell.tsx"),
    read("lib/game/phase15-simulation.ts"),
  ]);

  for (const id of ["map", "attributes", "inventory", "relations", "livelihood", "quests", "household"]) {
    assert.match(`${shell}\n${simulation}`, new RegExp(`activeModule === "${id}"|id: "${id}"|"${id}"`));
  }
  assert.match(shell, /空格：聚焦行动，不自动提交/);
  assert.match(shell, /108 坊只作为未来证据索引目标/);
  assert.match(`${shell}\n${simulation}`, /胥吏不等于品官|当前切片不提供任官/);
  assert.match(shell, /图片、短信、微信、QQ、支付与 Passkey 均未启用/);
  assert.doesNotMatch(shell, /一键登基|全国调兵|后宫管理/);
});

test("phase 15 day settlement remains part of one deterministic turn", async () => {
  const rules = await read("lib/game/rules.ts");
  const schemas = await read("lib/game/schemas.ts");
  const simulation = await read("lib/game/phase15-simulation.ts");

  assert.match(schemas, /energy: z\.object/);
  assert.match(schemas, /morale: z\.number/);
  assert.match(rules, /const closesDay = nextTurn % 3 === 0/);
  assert.match(rules, /current: closesDay[\s\S]*state\.energy\.max/);
  assert.match(simulation, /const remainingSlots = 3 - usedSlots/);
  assert.match(simulation, /只披露编辑模板声明的方向/);
});

test("phase 15 responsive shell preserves no-document-overflow contract", async () => {
  const css = await read("app/globals.css");
  const page = await read("app/page.tsx");

  assert.match(css, /\.phase15-workspace/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.phase15-module-nav/);
  assert.match(css, /\.phase15-statusbar/);
  assert.match(page, /<Phase15GameShell/);
});
