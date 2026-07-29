"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PHASE14_PLAYTEST } from "@/lib/playtest/config";
import {
  clientPlaytestEventSchema,
  playtestEnrollmentSchema,
  type ClientPlaytestEvent,
  type PlaytestEnrollment,
} from "@/lib/playtest/schemas";

export async function getCurrentPlaytestEnrollment(
  client: SupabaseClient,
): Promise<PlaytestEnrollment | null> {
  const { data, error } = await client
    .from("playtest_enrollments")
    .select("id,owner_id,app_release,content_version,scenario_id,scenario_version,consent_version,cohort,consented_at,created_at")
    .eq("app_release", PHASE14_PLAYTEST.appRelease)
    .eq("content_version", PHASE14_PLAYTEST.contentVersion)
    .eq("scenario_id", PHASE14_PLAYTEST.scenarioId)
    .eq("scenario_version", PHASE14_PLAYTEST.scenarioVersion)
    .maybeSingle();
  if (error) throw error;
  return data ? playtestEnrollmentSchema.parse(data) : null;
}

export async function joinPhase14Playtest(
  client: SupabaseClient,
  ownerId: string,
): Promise<PlaytestEnrollment> {
  const existing = await getCurrentPlaytestEnrollment(client);
  if (existing) return existing;

  const { data, error } = await client
    .from("playtest_enrollments")
    .insert({
      owner_id: ownerId,
      app_release: PHASE14_PLAYTEST.appRelease,
      content_version: PHASE14_PLAYTEST.contentVersion,
      scenario_id: PHASE14_PLAYTEST.scenarioId,
      scenario_version: PHASE14_PLAYTEST.scenarioVersion,
      consent_version: PHASE14_PLAYTEST.consentVersion,
      cohort: PHASE14_PLAYTEST.cohort,
    })
    .select("id,owner_id,app_release,content_version,scenario_id,scenario_version,consent_version,cohort,consented_at,created_at")
    .single();
  if (error) throw error;
  return playtestEnrollmentSchema.parse(data);
}

export async function withdrawFromPhase14Playtest(
  client: SupabaseClient,
  enrollmentId: string,
): Promise<void> {
  const { error } = await client
    .from("playtest_enrollments")
    .delete()
    .eq("id", enrollmentId);
  if (error) throw error;
}

export async function recordClientPlaytestEvent(
  client: SupabaseClient,
  input: Omit<ClientPlaytestEvent, "clientEventId"> & { clientEventId?: string },
): Promise<void> {
  const event = clientPlaytestEventSchema.parse({
    ...input,
    clientEventId: input.clientEventId ?? crypto.randomUUID(),
  });
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) return;

  await fetch("/api/playtest/events", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
    keepalive: event.eventName === "player_exit",
  }).catch(() => undefined);
}

