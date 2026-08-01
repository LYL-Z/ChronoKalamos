import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnRequest, TurnStreamEvent } from "@/lib/game/schemas";
import { PHASE14_PLAYTEST } from "@/lib/playtest/config";
import type { ClientPlaytestEvent, PlaytestEventName } from "@/lib/playtest/schemas";

type SessionContext = {
  id: string;
  owner_id: string;
  scenario_id: string;
  content_version: string;
  character_profile?: { origin?: string } | null;
  world_state?: {
    time?: { turn?: number };
    story?: { currentEventId?: string };
  } | null;
};

type SparseEvent = {
  eventName: PlaytestEventName;
  eventKey: string;
  session?: SessionContext | null;
  flowId?: string | null;
  eventId?: string | null;
  choiceId?: string | null;
  inputKind?: "choice" | "free_text" | null;
  turnNumber?: number | null;
  latencyMs?: number | null;
  resultCode?: string | null;
  exitPoint?: string | null;
  recoveryPath?: string | null;
  sourceCount?: number | null;
  classification?: "record" | "reconstruction" | "fiction" | null;
};

function classificationCode(
  value: "史料记载" | "合理重建" | "叙事虚构",
): "record" | "reconstruction" | "fiction" {
  if (value === "史料记载") return "record";
  if (value === "合理重建") return "reconstruction";
  return "fiction";
}

async function activeEnrollment(
  serverClient: SupabaseClient,
  ownerId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await serverClient
    .from("playtest_enrollments")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("app_release", PHASE14_PLAYTEST.appRelease)
    .eq("content_version", PHASE14_PLAYTEST.contentVersion)
    .eq("scenario_id", PHASE14_PLAYTEST.scenarioId)
    .eq("scenario_version", PHASE14_PLAYTEST.scenarioVersion)
    .maybeSingle();
  if (error) throw new Error(`playtest_enrollment_lookup_failed:${error.message}`);
  return data;
}

async function insertSparseEvent(
  serverClient: SupabaseClient,
  ownerId: string,
  event: SparseEvent,
): Promise<void> {
  const enrollment = await activeEnrollment(serverClient, ownerId);
  if (!enrollment) return;
  const session = event.session;
  if (session && (
    session.owner_id !== ownerId
    || session.scenario_id !== PHASE14_PLAYTEST.scenarioId
    || session.content_version !== PHASE14_PLAYTEST.contentVersion
  )) return;

  const { error } = await serverClient
    .from("playtest_events")
    .upsert({
      enrollment_id: enrollment.id,
      owner_id: ownerId,
      game_session_id: session?.id ?? null,
      event_key: event.eventKey,
      app_release: PHASE14_PLAYTEST.appRelease,
      content_version: PHASE14_PLAYTEST.contentVersion,
      scenario_id: PHASE14_PLAYTEST.scenarioId,
      scenario_version: PHASE14_PLAYTEST.scenarioVersion,
      event_name: event.eventName,
      origin_id: session?.character_profile?.origin ?? null,
      event_id: event.eventId ?? session?.world_state?.story?.currentEventId ?? null,
      choice_id: event.choiceId ?? null,
      input_kind: event.inputKind ?? null,
      turn_number: event.turnNumber ?? null,
      flow_id: event.flowId ?? null,
      latency_ms: event.latencyMs ?? null,
      result_code: event.resultCode ?? null,
      exit_point: event.exitPoint ?? null,
      recovery_path: event.recoveryPath ?? null,
      source_count: event.sourceCount ?? null,
      classification: event.classification ?? null,
    }, {
      onConflict: "owner_id,event_key",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`playtest_event_insert_failed:${error.message}`);
}

export async function loadPlaytestSessionContext(
  serverClient: SupabaseClient,
  ownerId: string,
  gameSessionId: string,
): Promise<SessionContext | null> {
  const { data, error } = await serverClient
    .from("game_sessions")
    .select("id,owner_id,scenario_id,content_version,character_profile,world_state")
    .eq("id", gameSessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(`playtest_session_lookup_failed:${error.message}`);
  return data as SessionContext | null;
}

export async function recordClientEvent(
  serverClient: SupabaseClient,
  ownerId: string,
  input: ClientPlaytestEvent,
): Promise<void> {
  const session = input.gameSessionId
    ? await loadPlaytestSessionContext(serverClient, ownerId, input.gameSessionId)
    : null;
  if (input.gameSessionId && !session) return;
  await insertSparseEvent(serverClient, ownerId, {
    eventName: input.eventName,
    eventKey: `client:${input.clientEventId}`,
    session,
    exitPoint: input.exitPoint,
    recoveryPath: input.recoveryPath,
    resultCode: input.resultCode,
  });
}

export async function recordTurnSubmission(
  serverClient: SupabaseClient,
  ownerId: string,
  session: SessionContext | null,
  request: TurnRequest,
): Promise<void> {
  if (!session) return;
  await insertSparseEvent(serverClient, ownerId, {
    eventName: "choice_submitted",
    eventKey: `choice_submitted:${request.clientTurnId}`,
    session,
    flowId: request.clientTurnId,
    eventId: session.world_state?.story?.currentEventId,
    choiceId: request.action.kind === "choice" ? request.action.choiceId : null,
    inputKind: request.action.kind === "choice" ? "choice" : "free_text",
    turnNumber: request.expectedStateVersion + 1,
  });
}

export async function recordTurnOutcome(
  serverClient: SupabaseClient,
  ownerId: string,
  session: SessionContext | null,
  request: TurnRequest,
  event: TurnStreamEvent,
  latencyMs: number,
): Promise<void> {
  if (!session) return;
  if (event.event === "turn.failed") {
    await insertSparseEvent(serverClient, ownerId, {
      eventName: "turn_failed",
      eventKey: `turn_failed:${request.clientTurnId}`,
      session,
      flowId: request.clientTurnId,
      turnNumber: request.expectedStateVersion + 1,
      latencyMs,
      resultCode: event.data.code.replace(/[^a-z0-9_:-]/gi, "_").toLowerCase().slice(0, 64),
    });
  }
  if (event.event === "state.committed") {
    await insertSparseEvent(serverClient, ownerId, {
      eventName: "turn_committed",
      eventKey: `turn_committed:${request.clientTurnId}`,
      session,
      flowId: request.clientTurnId,
      eventId: event.data.narrative.eventId,
      choiceId: event.data.narrative.resolvedChoiceId,
      turnNumber: event.data.stateVersion,
      latencyMs,
      sourceCount: event.data.narrative.sourceIds.length,
      classification: classificationCode(event.data.narrative.narrative.classification),
      resultCode: event.data.duplicate ? "duplicate_replay" : "committed",
    });
  }
}

