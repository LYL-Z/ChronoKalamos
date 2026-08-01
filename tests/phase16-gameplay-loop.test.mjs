import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 16 adds derived retention systems without a second authoritative store", async () => {
  const [shell, progression] = await Promise.all([
    read("components/phase15-game-shell.tsx"),
    read("lib/game/phase16-progression.ts"),
  ]);

  for (const label of ["证据图鉴", "成就与旬目标", "模拟旬目标", "当前旬目标"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(progression, /getPhase16Progression/);
  assert.match(progression, /getPhase16SettlementChanges/);
  assert.match(progression, /getRuntimeCatalog/);
  assert.doesNotMatch(progression, /supabase|fetch\(|insert\(|update\(|rpc\(/i);
});

test("phase 16 shortcuts navigate but never submit a turn", async () => {
  const shell = await read("components/phase15-game-shell.tsx");
  assert.match(shell, /data-phase16-choice/);
  assert.match(shell, /1–5：聚焦选项/);
  assert.match(shell, /1–5：聚焦选项，不自动提交/);
  assert.doesNotMatch(shell, /event\.code === "Space"[\s\S]{0,300}onSubmitAction/);
});

test("phase 16 adult content gate fails closed and stays server-only", async () => {
  const [capability, envExample, shell] = await Promise.all([
    read("lib/capabilities/phase16.ts"),
    read(".env.example"),
    read("components/phase15-game-shell.tsx"),
  ]);

  assert.match(capability, /publishable: violations\.length === 0/);
  assert.match(capability, /当前公开版保持 16\+/);
  assert.match(envExample, /MATURE_CONTENT_ENABLED=false/);
  assert.match(envExample, /MATURE_AGE_GATE_ENABLED=false/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_MATURE/);
  assert.match(shell, /phase16PublicMatureContentStatus/);
});
