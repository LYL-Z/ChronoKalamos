import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = new URL("../lib/auth/phone/config.ts", import.meta.url);
const turnstile = new URL("../lib/security/turnstile.ts", import.meta.url);
const twilio = new URL("../lib/auth/phone/twilio-verify.ts", import.meta.url);
const layout = new URL("../app/layout.tsx", import.meta.url);
const csp = new URL("../lib/security/http.ts", import.meta.url);
const startRoute = new URL("../app/api/auth/phone/start/route.ts", import.meta.url);
const provider = new URL("../lib/auth/phone/provider.ts", import.meta.url);
const guardrails = new URL("../lib/auth/phone/guardrails.ts", import.meta.url);
const migration = new URL("../supabase/migrations/20260727071119_phase7_phone_auth_guardrails.sql", import.meta.url);
const circuitBreakerMigration = new URL("../supabase/migrations/20260727075708_phase7_phone_daily_circuit_breaker.sql", import.meta.url);
const turnstileWidget = new URL("../components/turnstile-widget.tsx", import.meta.url);
const envExample = new URL("../.env.example", import.meta.url);
const identityBinding = new URL("../lib/auth/phone/identity-binding.ts", import.meta.url);
const identityBindingMigration = new URL("../supabase/migrations/20260727121702_phase7_phone_identity_binding.sql", import.meta.url);
const checkRoute = new URL("../app/api/auth/phone/check/route.ts", import.meta.url);
const phonePanel = new URL("../components/phone-auth-panel.tsx", import.meta.url);

test("phase 7 provider preparation keeps secrets server-side", async () => {
  const [configSource, turnstileSource, twilioSource, layoutSource, cspSource, routeSource, providerSource, guardrailSource, migrationSource, circuitBreakerSource, widgetSource, envSource, identitySource, identityMigrationSource, checkSource, panelSource] = await Promise.all([
    readFile(config, "utf8"),
    readFile(turnstile, "utf8"),
    readFile(twilio, "utf8"),
    readFile(layout, "utf8"),
    readFile(csp, "utf8"),
    readFile(startRoute, "utf8"),
    readFile(provider, "utf8"),
    readFile(guardrails, "utf8"),
    readFile(migration, "utf8"),
    readFile(circuitBreakerMigration, "utf8"),
    readFile(turnstileWidget, "utf8"),
    readFile(envExample, "utf8"),
    readFile(identityBinding, "utf8"),
    readFile(identityBindingMigration, "utf8"),
    readFile(checkRoute, "utf8"),
    readFile(phonePanel, "utf8"),
  ]);

  assert.match(configSource, /CN-mainland/);
  assert.match(configSource, /twilio-verify/);
  assert.match(configSource, /cloudflare-turnstile/);
  assert.match(configSource, /PHONE_AUTH_POLICY_VERIFIED/);
  assert.match(configSource, /PHONE_AUTH_PROVIDER/);
  assert.match(configSource, /providerMode/);
  assert.match(turnstileSource, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(turnstileSource, /TURNSTILE_SECRET/);
  assert.match(twilioSource, /verify\.twilio\.com\/v2\/Services/);
  assert.match(twilioSource, /TWILIO_AUTH_TOKEN/);
  assert.match(layoutSource, /turnstileSiteKey/);
  assert.match(cspSource, /challenges\.cloudflare\.com/);
  assert.match(routeSource, /phone_auth_not_enabled/);
  assert.match(routeSource, /不会发送真实短信/);
  assert.match(routeSource, /verifyTurnstileToken/);
  assert.match(routeSource, /reservePhoneSend/);
  assert.match(routeSource, /completePhoneSend/);
  assert.match(routeSource, /preflightPhoneIdentityBinding/);
  assert.match(routeSource, /bearerAccessToken/);
  assert.match(providerSource, /class MockPhoneAuthProvider/);
  assert.match(providerSource, /class TwilioPhoneAuthProvider/);
  assert.match(guardrailSource, /reserve_phone_auth_send/);
  assert.match(guardrailSource, /record_phone_auth_audit/);
  assert.match(migrationSource, /phone_auth_audit/);
  assert.match(migrationSource, /pg_advisory_xact_lock/);
  assert.match(migrationSource, /revoke all on public\.phone_auth_audit/);
  assert.match(circuitBreakerSource, /result_code not in \('phone_cooldown', 'ip_daily_limit', 'daily_limit'\)/);
  assert.match(widgetSource, /turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widgetSource, /turnstile\.reset/);
  assert.match(identitySource, /auth\.admin\.updateUserById/);
  assert.match(identitySource, /phone_replacement_requires_reauth/);
  assert.match(identitySource, /phone_authentication_required/);
  assert.match(identityMigrationSource, /prepare_verified_phone_binding/);
  assert.match(identityMigrationSource, /pg_advisory_xact_lock/);
  assert.match(identityMigrationSource, /phone_change_sent_at/);
  assert.match(identityMigrationSource, /revoke all on function public\.prepare_verified_phone_binding/);
  assert.match(checkSource, /bindVerifiedPhoneIdentity/);
  assert.match(checkSource, /approved_and_bound/);
  assert.match(panelSource, /authorization/);
  assert.match(panelSource, /邮箱仍是主要恢复凭证/);
  assert.match(envSource, /PHONE_AUTH_PROVIDER=mock/);
  assert.match(envSource, /TWILIO_ACCOUNT_SID=/);
  assert.match(envSource, /TWILIO_AUTH_TOKEN=/);
  assert.match(envSource, /TWILIO_VERIFY_SERVICE_SID=/);
  assert.doesNotMatch(envSource, /NEXT_PUBLIC_TWILIO/);
  assert.doesNotMatch(layoutSource, /TURNSTILE_SECRET/);
  assert.doesNotMatch(layoutSource, /TWILIO_AUTH_TOKEN/);
});
