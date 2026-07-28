import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/page.tsx", import.meta.url);
const saves = new URL("../lib/supabase/saves.ts", import.meta.url);
const migration = new URL("../supabase/migrations/20260727153227_phase9_character_profile.sql", import.meta.url);
const styles = new URL("../app/globals.css", import.meta.url);

test("phase 9 onboarding keeps character setup bounded and reviewable", async () => {
  const [pageSource, savesSource, migrationSource, stylesSource] = await Promise.all([
    readFile(page, "utf8"),
    readFile(saves, "utf8"),
    readFile(migration, "utf8"),
    readFile(styles, "utf8"),
  ]);

  assert.match(pageSource, /FIRST RECORDED LIFE/);
  assert.match(pageSource, /characterProfile/);
  assert.match(pageSource, /character-name/);
  assert.match(pageSource, /temperament-choice/);
  assert.match(pageSource, /image-action-prep/);
  assert.match(pageSource, /utility-panel/);
  assert.match(savesSource, /updateGameCharacterProfile/);
  assert.match(migrationSource, /update_game_character_profile/);
  assert.match(migrationSource, /invalid_character_profile/);
  assert.match(migrationSource, /session_not_owned/);
  assert.match(stylesSource, /\.profile-fields/);
  assert.match(stylesSource, /\.recap-card/);
});
