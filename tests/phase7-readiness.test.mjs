import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const capabilityPolicy = new URL("../lib/capabilities/phase7.ts", import.meta.url);
const identityPanel = new URL("../components/identity-panel.tsx", import.meta.url);
const providerOnboarding = new URL("../docs/provider-onboarding.md", import.meta.url);
const scenarioTemplate = new URL("../docs/scenario-expansion-template.md", import.meta.url);

test("phase 7 keeps phone auth behind evidence gates", async () => {
  const [policySource, identitySource, providerSource, scenarioSource] = await Promise.all([
    readFile(capabilityPolicy, "utf8"),
    readFile(identityPanel, "utf8"),
    readFile(providerOnboarding, "utf8"),
    readFile(scenarioTemplate, "utf8"),
  ]);

  assert.match(policySource, /id: "phone-auth"/);
  assert.match(policySource, /status: "evaluating"/);
  assert.match(policySource, /phone-change-cleanup/);
  assert.match(policySource, /sandbox-e2e/);
  assert.match(policySource, /active\.length > 1/);
  assert.match(identitySource, /phase7PublicIdentityStatus/);
  assert.doesNotMatch(identitySource, /signInWithOtp\(\{\s*phone:/);
  assert.match(providerSource, /phone_change/);
  assert.match(providerSource, /CAPTCHA/);
  assert.match(providerSource, /auth\.users\.id.*保持不变/);
  assert.match(scenarioSource, /一座城市、一个年份、三种身份/);
  assert.match(scenarioSource, /20 回合/);
});
