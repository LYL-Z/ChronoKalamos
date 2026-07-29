import { z } from "zod";

const manifestSchema = z.array(z.object({
  scenario_id: z.literal("tang-changan-742"),
  content_version: z.string().regex(/^\d+\.\d+\.\d+$/),
}));

export type ReadinessResult = {
  status: "ready" | "degraded";
  checks: {
    application: "ok";
    contentDatabase: "ok" | "unavailable" | "not_configured";
  };
  contentVersion?: string;
};

export async function checkReadiness(options: {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<ReadinessResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return {
      status: "degraded",
      checks: { application: "ok", contentDatabase: "not_configured" },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = new URL("/rest/v1/scenario_manifests", url);
    endpoint.searchParams.set("select", "scenario_id,content_version");
    endpoint.searchParams.set("scenario_id", "eq.tang-changan-742");
    endpoint.searchParams.set("published", "eq.true");
    endpoint.searchParams.set("limit", "1");
    const response = await fetcher(endpoint, {
      headers: {
        apikey: publishableKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`readiness_status_${response.status}`);
    const manifest = manifestSchema.parse(await response.json());
    if (manifest.length !== 1) throw new Error("readiness_manifest_missing");
    return {
      status: "ready",
      checks: { application: "ok", contentDatabase: "ok" },
      contentVersion: manifest[0].content_version,
    };
  } catch {
    return {
      status: "degraded",
      checks: { application: "ok", contentDatabase: "unavailable" },
    };
  } finally {
    clearTimeout(timeout);
  }
}
