import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createInitialWorldState } from "@/lib/game/rules";
import { worldStateSchema } from "@/lib/game/schemas";

const originSchema = z.enum(["merchant", "craft", "clerk"]);
export const characterProfileSchema = z.object({
  origin: originSchema,
  name: z.string().min(1).max(40).optional(),
  gender: z.enum(["unspecified", "female", "male", "nonbinary"]).optional(),
  temperament: z.enum(["谨慎", "好奇", "克制", "外向"]).optional(),
}).strict();

export type CharacterProfile = z.infer<typeof characterProfileSchema>;

export const saveSummarySchema = z.object({
  id: z.string().uuid(),
  client_session_id: z.string().uuid(),
  scenario_id: z.string(),
  title: z.string(),
  status: z.enum(["draft", "active", "ended", "archived"]),
  state_version: z.number().int().nonnegative(),
  updated_at: z.string(),
});

export type SaveSummary = z.infer<typeof saveSummarySchema>;

export const gameSessionSchema = saveSummarySchema.extend({
  world_state: worldStateSchema,
  character_profile: characterProfileSchema.optional(),
});

export type GameSession = z.infer<typeof gameSessionSchema>;

export function prototypeSaveStorageKey(originId: string): string {
  return `chronokalamos:prototype-session:${originSchema.parse(originId)}`;
}

export function getOrCreateClientSessionId(originId: string): string {
  const key = prototypeSaveStorageKey(originId);
  const stored = window.localStorage.getItem(key);
  if (stored && z.string().uuid().safeParse(stored).success) return stored;

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export function rotateClientSessionId(originId: string): string {
  const key = prototypeSaveStorageKey(originId);
  const next = window.crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export function createPrototypeSavePayload(
  ownerId: string,
  originId: string,
  clientSessionId: string,
) {
  const origin = originSchema.parse(originId);
  const titles: Record<z.infer<typeof originSchema>, string> = {
    merchant: "西市粟特商户家庭后辈",
    craft: "长安工匠家庭学徒",
    clerk: "京兆基层吏员家庭成员",
  };

  return {
    owner_id: z.string().uuid().parse(ownerId),
    client_session_id: z.string().uuid().parse(clientSessionId),
    scenario_id: "tang-changan-742",
    title: titles[origin],
    character_profile: { origin },
    world_state: createInitialWorldState(origin),
    status: "draft" as const,
    state_version: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function savePrototypeSession(
  client: SupabaseClient,
  originId: string,
): Promise<SaveSummary> {
  const session = await getOrCreateGameSession(client, originId);
  return saveSummarySchema.parse(session);
}

export async function getOrCreateGameSession(
  client: SupabaseClient,
  originId: string,
): Promise<GameSession> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("请先创建游客身份或登录邮箱账户。");

  originSchema.parse(originId);
  const { data, error } = await client.rpc("create_or_get_game_session", {
    p_client_session_id: getOrCreateClientSessionId(originId),
    p_origin_id: originId,
  });
  if (error) throw error;
  return gameSessionSchema.parse(data);
}

export async function updateGameCharacterProfile(
  client: SupabaseClient,
  sessionId: string,
  profile: CharacterProfile,
): Promise<void> {
  const session = z.string().uuid().parse(sessionId);
  const validated = characterProfileSchema.parse(profile);
  const { error } = await client.rpc("update_game_character_profile", {
    p_session_id: session,
    p_profile: validated,
  });
  if (error) throw error;
}

export async function listOwnSaves(client: SupabaseClient): Promise<SaveSummary[]> {
  const { data, error } = await client
    .from("game_sessions")
    .select("id,client_session_id,scenario_id,title,status,state_version,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return z.array(saveSummarySchema).parse(data ?? []);
}
