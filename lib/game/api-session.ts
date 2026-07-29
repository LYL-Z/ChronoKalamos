import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { createAuthenticatedSupabaseClient } from "@/lib/game/supabase-repository";
import { normalizeWorldState } from "@/lib/game/rules";
import { originIdSchema, type WorldState } from "@/lib/game/schemas";

const apiSessionRowSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  scenario_id: z.literal("tang-changan-742"),
  content_version: z.enum(["10.0.0", "11.0.0"]),
  character_profile: z.object({ origin: originIdSchema }).passthrough(),
  world_state: z.unknown(),
  status: z.enum(["draft", "active", "ended", "archived"]),
  state_version: z.number().int().nonnegative(),
}).passthrough();

export type ApiSession = {
  id: string;
  owner_id: string;
  scenario_id: "tang-changan-742";
  content_version: "10.0.0" | "11.0.0";
  character_profile: z.infer<typeof apiSessionRowSchema>["character_profile"];
  status: "draft" | "active" | "ended" | "archived";
  state_version: number;
  world_state: WorldState;
};

export function bearerToken(request: Request): string | null {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return token && token.length <= 8192 ? token : null;
}

export async function authenticateApiRequest(
  request: Request,
): Promise<{ client: SupabaseClient; user: User; token: string }> {
  const token = bearerToken(request);
  if (!token) throw new Error("authentication_required");
  const client = createAuthenticatedSupabaseClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("authentication_invalid");
  return { client, user: data.user, token };
}

export async function loadOwnedApiSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<ApiSession> {
  const id = z.string().uuid().parse(sessionId);
  const { data, error } = await client
    .from("game_sessions")
    .select("id,owner_id,scenario_id,content_version,character_profile,world_state,status,state_version")
    .eq("id", id)
    .single();
  if (error) throw new Error("session_not_found");
  const parsed = apiSessionRowSchema.parse(data);
  return {
    ...parsed,
    world_state: normalizeWorldState(parsed.world_state, parsed.character_profile.origin),
  };
}
