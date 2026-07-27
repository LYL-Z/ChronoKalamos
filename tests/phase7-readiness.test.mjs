import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const capabilityPolicy = new URL("../lib/capabilities/phase7.ts", import.meta.url);
const identityPanel = new URL("../components/identity-panel.tsx", import.meta.url);
const totpPanel = new URL("../components/totp-mfa-panel.tsx", import.meta.url);
const totpClient = new URL("../lib/supabase/totp.ts", import.meta.url);
const totpMigration = new URL("../supabase/migrations/20260727131336_phase7_totp_aal2.sql", import.meta.url);
const providerOnboarding = new URL("../docs/provider-onboarding.md", import.meta.url);
const scenarioTemplate = new URL("../docs/scenario-expansion-template.md", import.meta.url);

test("phase 7 advances TOTP while keeping SMS and Passkey disabled", async () => {
  const [policySource, identitySource, panelSource, clientSource, migrationSource, providerSource, scenarioSource] = await Promise.all([
    readFile(capabilityPolicy, "utf8"),
    readFile(identityPanel, "utf8"),
    readFile(totpPanel, "utf8"),
    readFile(totpClient, "utf8"),
    readFile(totpMigration, "utf8"),
    readFile(providerOnboarding, "utf8"),
    readFile(scenarioTemplate, "utf8"),
  ]);

  assert.match(policySource, /id: "totp-mfa"/);
  assert.match(policySource, /status: "enabled"/);
  assert.match(policySource, /id: "phone-auth"[\s\S]*status: "not_started"/);
  assert.match(policySource, /id: "passkey-auth"[\s\S]*status: "not_started"/);
  assert.match(policySource, /live-e2e/);
  assert.match(policySource, /active\.length > 1/);
  assert.match(identitySource, /phase7PublicIdentityStatus/);
  assert.match(identitySource, /TotpMfaPanel/);
  assert.doesNotMatch(identitySource, /PhoneAuthPanel/);
  assert.doesNotMatch(identitySource, /signInWithOtp\(\{\s*phone:/);
  assert.match(panelSource, /添加备用验证器/);
  assert.match(panelSource, /AAL2/);
  assert.match(clientSource, /challengeAndVerify/);
  assert.match(clientSource, /factorType: "totp"/);
  assert.match(migrationSource, /as restrictive/);
  assert.match(migrationSource, /auth\.mfa_factors/);
  assert.match(migrationSource, /private\.session_meets_mfa\(\)/);
  assert.match(migrationSource, /grant execute on function private\.session_meets_mfa\(\) to authenticated/);
  assert.doesNotMatch(migrationSource, /grant select on auth\.mfa_factors/i);
  assert.match(migrationSource, /mfa_required/);
  assert.match(providerSource, /TOTP/);
  assert.match(providerSource, /短信与手机号登录/);
  assert.match(scenarioSource, /一座城市、一个年份、三种身份/);
  assert.match(scenarioSource, /20 回合/);
});
