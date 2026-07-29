import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicResponse,
  createUpstreamRequest,
  rewriteLocation,
  rewriteSetCookie,
} from "../cloudflare/mainland-edge-proxy.mjs";

const upstreamOrigin =
  "https://chronokalamos.burrows-bandeau-7x.chatgpt.site";

test("rewrites only same-upstream redirects to the public hostname", () => {
  const publicUrl = new URL("https://chronokalamos.com/playtest");
  const upstreamUrl = new URL(`${upstreamOrigin}/playtest`);

  assert.equal(
    rewriteLocation("/settings", publicUrl, upstreamUrl),
    "https://chronokalamos.com/settings",
  );
  assert.equal(
    rewriteLocation("https://example.com/help", publicUrl, upstreamUrl),
    "https://example.com/help",
  );
});

test("rewrites the upstream bot cookie domain", () => {
  const cookie =
    "__cf_bm=value; HttpOnly; Secure; Domain=chatgpt.site; Path=/";

  assert.equal(
    rewriteSetCookie(cookie, "chronokalamos.com"),
    "__cf_bm=value; HttpOnly; Secure; Domain=chronokalamos.com; Path=/",
  );
});

test("does not forward client network identity headers to the upstream", () => {
  const publicUrl = new URL("https://chronokalamos.com/api/ready");
  const upstreamUrl = new URL(`${upstreamOrigin}/api/ready`);
  const request = new Request(publicUrl, {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "cf-ipcountry": "CN",
      "x-forwarded-for": "203.0.113.10",
    },
  });

  const upstreamRequest = createUpstreamRequest(
    request,
    upstreamUrl,
    publicUrl,
  );

  assert.equal(upstreamRequest.url, upstreamUrl.href);
  assert.equal(upstreamRequest.headers.get("cf-connecting-ip"), null);
  assert.equal(upstreamRequest.headers.get("cf-ipcountry"), null);
  assert.equal(upstreamRequest.headers.get("x-forwarded-for"), null);
  assert.equal(
    upstreamRequest.headers.get("x-forwarded-host"),
    "chronokalamos.com",
  );
});

test("adds verifiable edge headers to streamed upstream responses", async () => {
  const publicUrl = new URL("https://chronokalamos.com/playtest");
  const upstreamUrl = new URL(`${upstreamOrigin}/playtest`);
  const upstreamResponse = new Response("ok", {
    headers: {
      location: `${upstreamOrigin}/settings`,
      "set-cookie":
        "__cf_bm=value; HttpOnly; Secure; Domain=chatgpt.site; Path=/",
    },
    status: 200,
  });

  const response = createPublicResponse(
    upstreamResponse,
    publicUrl,
    upstreamUrl,
  );

  assert.equal(response.headers.get("x-chronokalamos-edge"), "mainland-proxy-v1");
  assert.equal(response.headers.get("x-chronokalamos-origin-status"), "200");
  assert.equal(response.headers.get("location"), "https://chronokalamos.com/settings");
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /Domain=chronokalamos\.com/,
  );
  assert.equal(await response.text(), "ok");
});
