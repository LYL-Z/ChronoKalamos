import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/page.tsx", import.meta.url);
const gameShell = new URL("../components/phase15-game-shell.tsx", import.meta.url);
const route = new URL("../app/api/game-sessions/[sessionId]/turns/route.ts", import.meta.url);
const provider = new URL("../lib/game/ai-provider.ts", import.meta.url);
const schemas = new URL("../lib/game/schemas.ts", import.meta.url);
const stateDocs = new URL("../docs/game-state.md", import.meta.url);
const evalDocs = new URL("../docs/ai-evals.md", import.meta.url);

test("phase 5 user-facing game screen exposes evidence, state, timeline and failure boundaries", async () => {
  const [pageSource, shellSource, routeSource, providerSource, schemaSource, stateDoc, evalDoc] = await Promise.all([
    readFile(page, "utf8"),
    readFile(gameShell, "utf8"),
    readFile(route, "utf8"),
    readFile(provider, "utf8"),
    readFile(schemas, "utf8"),
    readFile(stateDocs, "utf8"),
    readFile(evalDocs, "utf8"),
  ]);
  const interfaceSource = `${pageSource}\n${shellSource}`;

  assert.match(interfaceSource, /常驻游戏状态/);
  assert.match(interfaceSource, /ChapterTimeline/);
  assert.match(interfaceSource, /本回合未提交/);
  assert.match(interfaceSource, /图片、短信、微信、QQ、支付与 Passkey 均未启用/);
  assert.match(routeSource, /eventFrame/);
  assert.match(schemaSource, /turn\.started/);
  assert.match(schemaSource, /narrative\.delta/);
  assert.match(schemaSource, /choices\.ready/);
  assert.match(schemaSource, /state\.committed/);
  assert.match(schemaSource, /turn\.failed/);
  assert.match(routeSource, /text\/event-stream/);
  assert.match(providerSource, /DeepSeekChatProvider/);
  assert.match(providerSource, /response_format/);
  assert.match(providerSource, /json_object/);
  assert.match(providerSource, /DEEPSEEK_API_KEY/);
  assert.match(stateDoc, /game_turn_requests/);
  assert.match(evalDoc, /DeepSeek/);
});
