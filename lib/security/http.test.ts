import { describe, expect, it } from "vitest";
import { withSecurityHeaders } from "./http";

describe("security response headers", () => {
  it("keeps payments and sensors off without tightening CSP past the RSC runtime", () => {
    const response = withSecurityHeaders(new Response("ok"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const permissions = response.headers.get("Permissions-Policy") ?? "";

    expect(permissions).toContain("camera=()");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("payment=()");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
  });
});
