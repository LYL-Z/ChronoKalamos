import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const originSchema = z.enum(["merchant", "craft", "clerk"]);

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
    world_state: {
      time: "742-01-01",
      location: "changan",
      health: { condition: "stable" },
      socialIdentity: origin,
      occupation: null,
      money: {},
      items: [],
      relationships: [],
      reputation: {},
      skills: {},
      quests: [],
      risks: [],
      death: null,
    },
    status: "draft" as const,
    state_version: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function savePrototypeSession(
  client: SupabaseClient,
  originId: string,
): Promise<SaveSummary> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("请先创建游客身份或登录邮箱账户。");

  const payload = createPrototypeSavePayload(
    userData.user.id,
    originId,
    getOrCreateClientSessionId(originId),
  );
  const { data, error } = await client
    .from("game_sessions")
    .upsert(payload, { onConflict: "owner_id,client_session_id" })
    .select("id,client_session_id,scenario_id,title,status,state_version,updated_at")
    .single();

  if (error) throw error;
  return saveSummarySchema.parse(data);
}

export async function listOwnSaves(client: SupabaseClient): Promise<SaveSummary[]> {
  const { data, error } = await client
    .from("game_sessions")
    .select("id,client_session_id,scenario_id,title,status,state_version,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return z.array(saveSummarySchema).parse(data ?? []);
}

