import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = new URL("../lib/auth/phone/config.ts", import.meta.url);
const turnstile = new URL("../lib/security/turnstile.ts", import.meta.url);
const twilio = new URL("../lib/auth/phone/twilio-verify.ts", import.meta.url);
const layout = new URL("../app/layout.tsx", import.meta.url);
const csp = new URL("../lib/security/http.ts", import.meta.url);
const startRoute = new URL("../app/api/auth/phone/start/route.ts", import.meta.url);

test("phase 7 provider preparation keeps secrets server-side", async () => {
  const [configSource, turnstileSource, twilioSource, layoutSource, cspSource, routeSource] = await Promise.all([
    readFile(config, "utf8"),
    readFile(turnstile, "utf8"),
    readFile(twilio, "utf8"),
    readFile(layout, "utf8"),
    readFile(csp, "utf8"),
    readFile(startRoute, "utf8"),
  ]);

  assert.match(configSource, /CN-mainland/);
  assert.match(configSource, /twilio-verify/);
  assert.match(configSource, /cloudflare-turnstile/);
  assert.match(configSource, /PHONE_AUTH_POLICY_VERIFIED/);
  assert.match(turnstileSource, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(turnstileSource, /TURNSTILE_SECRET/);
  assert.match(twilioSource, /verify\.twilio\.com\/v2\/Services/);
  assert.match(twilioSource, /TWILIO_AUTH_TOKEN/);
  assert.match(layoutSource, /turnstileSiteKey/);
  assert.match(cspSource, /challenges\.cloudflare\.com/);
  assert.match(routeSource, /phone_auth_not_enabled/);
  assert.match(routeSource, /不会发送真实短信/);
  assert.doesNotMatch(layoutSource, /TURNSTILE_SECRET/);
  assert.doesNotMatch(layoutSource, /TWILIO_AUTH_TOKEN/);
});
