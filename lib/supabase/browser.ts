import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicConfigSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(20),
});

let browserClient: SupabaseClient | null = null;

export function readRuntimePublicConfig(): {
  url?: string;
  publishableKey?: string;
  turnstileSiteKey?: string;
  phoneAuthEnabled?: boolean;
  phoneAuthProvider?: string;
} {
  if (typeof document === "undefined") return {};
  const script = document.getElementById("chronokalamos-public-config");
  if (!script?.textContent) return {};
  try {
    const parsed: unknown = JSON.parse(script.textContent);
    if (!parsed || typeof parsed !== "object") return {};
    const candidate = parsed as {
      url?: unknown;
      publishableKey?: unknown;
      turnstileSiteKey?: unknown;
      phoneAuthEnabled?: unknown;
      phoneAuthProvider?: unknown;
    };
    return {
      url: typeof candidate.url === "string" ? candidate.url : undefined,
      publishableKey: typeof candidate.publishableKey === "string" ? candidate.publishableKey : undefined,
      turnstileSiteKey: typeof candidate.turnstileSiteKey === "string" ? candidate.turnstileSiteKey : undefined,
      phoneAuthEnabled: candidate.phoneAuthEnabled === true,
      phoneAuthProvider: typeof candidate.phoneAuthProvider === "string" ? candidate.phoneAuthProvider : undefined,
    };
  } catch {
    return {};
  }
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const runtimeConfig = readRuntimePublicConfig();
  const config = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || runtimeConfig.url,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || runtimeConfig.publishableKey,
  });

  if (!config.success) return null;

  browserClient ??= createClient(config.data.url, config.data.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
