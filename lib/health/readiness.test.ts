import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness";

describe("deployment readiness", () => {
  it("returns degraded without exposing missing configuration values", async () => {
    await expect(checkReadiness({ env: {} })).resolves.toEqual({
      status: "degraded",
      checks: { application: "ok", contentDatabase: "not_configured" },
    });
  });

  it("accepts one published bounded scenario manifest", async () => {
    const fetcher = async () => Response.json([{
      scenario_id: "tang-changan-742",
      content_version: "11.0.0",
    }]);
    await expect(checkReadiness({
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      },
      fetcher,
    })).resolves.toEqual({
      status: "ready",
      checks: { application: "ok", contentDatabase: "ok" },
      contentVersion: "11.0.0",
    });
  });

  it("fails closed on an invalid dependency response", async () => {
    const fetcher = async () => Response.json({ unexpected: true });
    await expect(checkReadiness({
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      },
      fetcher,
    })).resolves.toEqual({
      status: "degraded",
      checks: { application: "ok", contentDatabase: "unavailable" },
    });
  });
});
