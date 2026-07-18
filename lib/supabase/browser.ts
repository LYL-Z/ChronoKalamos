import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicConfigSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(20),
});

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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

