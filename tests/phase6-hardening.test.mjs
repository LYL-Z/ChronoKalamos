import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = new URL("../app/api/game-sessions/[sessionId]/turns/route.ts", import.meta.url);
const security = new URL("../lib/security/http.ts", import.meta.url);
const health = new URL("../app/api/health/route.ts", import.meta.url);
const layout = new URL("../app/layout.tsx", import.meta.url);
const browserConfig = new URL("../lib/supabase/browser.ts", import.meta.url);
const migration = new URL("../supabase/migrations/20260725223000_phase6_turn_rate_limit_and_retention.sql", import.meta.url);
const packageJson = new URL("../package.json", import.meta.url);
const identity = new URL("../components/identity-panel.tsx", import.meta.url);

test("phase 6 bounds turn requests and publishes a safe health endpoint", async () => {
  const [routeSource, securitySource, healthSource, migrationSource, packageSource, identitySource, layoutSource, browserSource] = await Promise.all([
    readFile(route, "utf8"),
    readFile(security, "utf8"),
    readFile(health, "utf8"),
    readFile(migration, "utf8"),
    readFile(packageJson, "utf8"),
    readFile(identity, "utf8"),
    readFile(layout, "utf8"),
    readFile(browserConfig, "utf8"),
  ]);
  const packageData = JSON.parse(packageSource);

  assert.match(routeSource, /MAX_TURN_REQUEST_BYTES = 24 \* 1024/);
  assert.match(routeSource, /readBoundedBody/);
  assert.match(routeSource, /sessionIdSchema = z\.string\(\)\.uuid\(\)/);
  assert.match(securitySource, /Content-Security-Policy/);
  assert.match(securitySource, /X-Content-Type-Options/);
  assert.match(securitySource, /Permissions-Policy/);
  assert.doesNotMatch(securitySource, /["']unsafe-eval["']/);
  assert.match(healthSource, /status: "ok"/);
  assert.match(migrationSource, /turn_rate_limited/);
  assert.match(migrationSource, /hashtextextended/);
  assert.match(migrationSource, /cleanup_game_turn_requests/);
  assert.match(packageSource, /"next": "16\.2\.11"/);
  assert.equal(packageData.overrides.postcss, "8.5.23");
  assert.equal(packageData.overrides.sharp, "0.35.3");
  assert.match(identitySource, /htmlFor="identity-password"/);
  assert.match(layoutSource, /chronokalamos-public-config/);
  assert.match(browserSource, /readRuntimePublicConfig/);
});
