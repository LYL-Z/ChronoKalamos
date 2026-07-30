import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/page.tsx", import.meta.url);
const gameShell = new URL("../components/phase15-game-shell.tsx", import.meta.url);
const saves = new URL("../lib/supabase/saves.ts", import.meta.url);
const migration = new URL("../supabase/migrations/20260727153227_phase9_character_profile.sql", import.meta.url);
const styles = new URL("../app/globals.css", import.meta.url);
const archivesPage = new URL("../app/saves/page.tsx", import.meta.url);
const settingsPage = new URL("../app/settings/page.tsx", import.meta.url);
const supportPage = new URL("../app/support/page.tsx", import.meta.url);

test("phase 9 onboarding keeps character setup bounded and reviewable", async () => {
  const [pageSource, shellSource, savesSource, migrationSource, stylesSource, archivesSource, settingsSource, supportSource] = await Promise.all([
    readFile(page, "utf8"),
    readFile(gameShell, "utf8"),
    readFile(saves, "utf8"),
    readFile(migration, "utf8"),
    readFile(styles, "utf8"),
    readFile(archivesPage, "utf8"),
    readFile(settingsPage, "utf8"),
    readFile(supportPage, "utf8"),
  ]);
  const interfaceSource = `${pageSource}\n${shellSource}`;

  assert.match(pageSource, /FIRST RECORDED LIFE/);
  assert.match(pageSource, /characterProfile/);
  assert.match(pageSource, /character-name/);
  assert.match(pageSource, /temperament-choice/);
  assert.match(interfaceSource, /图片、短信、微信、QQ、支付与 Passkey 均未启用/);
  assert.match(interfaceSource, /href="\/saves"/);
  assert.match(archivesSource, /listOwnSaves/);
  assert.match(settingsSource, /低动态模式/);
  assert.match(supportSource, /回合失败或断线/);
  assert.match(savesSource, /updateGameCharacterProfile/);
  assert.match(migrationSource, /update_game_character_profile/);
  assert.match(migrationSource, /invalid_character_profile/);
  assert.match(migrationSource, /session_not_owned/);
  assert.match(stylesSource, /\.profile-fields/);
  assert.match(stylesSource, /\.recap-card/);
});
