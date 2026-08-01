import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  committedTurnSchema,
  committedSystemActionSchema,
  evidenceClaimSchema,
  evidenceSourceSchema,
  originIdSchema,
  scenarioManifestSchema,
  type CommittedTurn,
  type CommittedSystemAction,
  type AuthoritativeSystemActionRequest,
  type AuthoritativeSystemEvent,
  type EvidenceClaim,
  type EvidenceSource,
  type EventTemplate,
  type ScenarioManifest,
  type TurnGeneration,
  type TurnRequest,
  type WorldState,
} from "@/lib/game/schemas";
import { getRuntimeCatalog } from "@/lib/game/event-catalog";
import { changanContent } from "@/lib/historical/content";
import {
  aiCallReservationSchema,
  type AiBudgetLimits,
  type AiCallReservation,
  type AiCallResultCode,
} from "@/lib/game/ai-budget";

const sessionSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  scenario_id: z.literal("tang-changan-742"),
  content_version: z.enum(["10.0.0", "11.0.0"]),
  character_profile: z.object({ origin: originIdSchema }).passthrough(),
  world_state: z.unknown(),
  status: z.enum(["draft", "active", "ended", "archived"]),
  state_version: z.number().int().nonnegative(),
}).passthrough();

const reserveResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("reserved"),
    inputHash: z.string(),
    leaseExpiresAt: z.string(),
  }).passthrough(),
  z.object({
    status: z.literal("in_progress"),
    inputHash: z.string(),
    leaseExpiresAt: z.string(),
  }).passthrough(),
  z.object({
    status: z.literal("committed"),
    inputHash: z.string(),
    snapshot: committedTurnSchema,
  }).passthrough(),
  z.object({
    status: z.literal("failed"),
    inputHash: z.string(),
    failureCode: z.string(),
    failureMessage: z.string(),
  }).passthrough(),
]);

const sourceRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  creator: z.string(),
  locator: z.string(),
  license_code: z.string(),
});

const claimRowSchema = z.object({
  id: z.string(),
  classification: z.enum(["史料记载", "合理重建", "叙事虚构"]),
  subject_kind: z.string(),
  subject_id: z.string(),
  text_zh: z.string(),
  source_ids: z.array(z.string()),
});

const uploadRowSchema = z.object({
  storage_path: z.string(),
  bucket_id: z.literal("user-uploads"),
  status: z.literal("ready"),
});

const manifestRowSchema = z.object({
  scenario_id: z.literal("tang-changan-742"),
  content_version: z.string(),
  era_start: z.literal(742),
  era_end: z.literal(742),
  locations: z.array(z.string()),
  origins: z.array(originIdSchema),
  evidence_policy: z.literal("source_required"),
  first_event_by_origin: z.record(originIdSchema, z.string()),
});

const eventRegistryRowSchema = z.object({
  event_id: z.string(),
  chapter_id: z.string(),
  origin_ids: z.array(originIdSchema),
  choice_ids: z.array(z.string()),
  consequence_keys: z.array(z.string()),
  next_event_ids: z.array(z.string().nullable()),
  evidence_refs: z.array(z.string()),
  publication_status: z.enum(["provisional", "published"]),
  runtime_availability: z.enum(["public-beta", "public"]),
  content_version: z.string(),
});

export type GameSessionRecord = z.infer<typeof sessionSchema>;
export type ReserveResult = z.infer<typeof reserveResultSchema>;

export type HistoricalEvidence = {
  claims: EvidenceClaim[];
  sources: EvidenceSource[];
};

export type NarrativeCatalog = {
  manifest: ScenarioManifest;
  events: EventTemplate[];
};

export interface GameTurnRepository {
  readonly userId: string;
  loadSession(sessionId: string): Promise<GameSessionRecord>;
  reserveTurn(sessionId: string, request: TurnRequest): Promise<ReserveResult>;
  loadNarrativeCatalog(session: GameSessionRecord): Promise<NarrativeCatalog>;
  retrieveEvidence(
    session: GameSessionRecord,
    event: EventTemplate,
  ): Promise<HistoricalEvidence>;
  createSignedUploadUrl(uploadId: string): Promise<string>;
  reserveAiCall(
    clientTurnId: string,
    attempt: 1 | 2,
    limits: AiBudgetLimits,
  ): Promise<AiCallReservation>;
  completeAiCall(
    clientTurnId: string,
    attempt: 1 | 2,
    resultCode: AiCallResultCode,
    latencyMs: number,
  ): Promise<void>;
  commitTurn(
    sessionId: string,
    request: TurnRequest,
    generation: TurnGeneration,
    nextState: WorldState,
    providerResponseId: string,
  ): Promise<CommittedTurn>;
  failTurn(sessionId: string, clientTurnId: string, code: string, message: string): Promise<void>;
  commitSystemAction?(
    sessionId: string,
    request: AuthoritativeSystemActionRequest,
    event: AuthoritativeSystemEvent,
    nextState: WorldState,
  ): Promise<CommittedSystemAction>;
  findSystemActionReplay?(
    sessionId: string,
    request: AuthoritativeSystemActionRequest,
  ): Promise<CommittedSystemAction | null>;
}

function requireConfig(): { url: string; publishableKey: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("supabase_server_not_configured");
  return { url, publishableKey };
}

function requireServerSecretConfig(): { url: string; secretKey: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("supabase_server_secret_not_configured");
  return { url, secretKey };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createAuthenticatedSupabaseClient(accessToken: string): SupabaseClient {
  const config = requireConfig();
  return createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createServerSupabaseClient(): SupabaseClient {
  const config = requireServerSecretConfig();
  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export class SupabaseGameRepository implements GameTurnRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly serverClient: SupabaseClient,
    readonly userId: string,
  ) {}

  async loadSession(sessionId: string): Promise<GameSessionRecord> {
    const { data, error } = await this.client
      .from("game_sessions")
      .select("id,owner_id,scenario_id,content_version,character_profile,world_state,status,state_version")
      .eq("id", sessionId)
      .single();
    if (error) throw new Error(`session_load_failed:${error.message}`);
    return sessionSchema.parse(data);
  }

  async reserveTurn(sessionId: string, request: TurnRequest): Promise<ReserveResult> {
    const { data, error } = await this.client.rpc("reserve_game_turn", {
      p_session_id: sessionId,
      p_client_turn_id: request.clientTurnId,
      p_expected_state_version: request.expectedStateVersion,
      p_input: { action: request.action },
    });
    if (error) throw new Error(`turn_reserve_failed:${error.message}`);
    return reserveResultSchema.parse(data);
  }

  async retrieveEvidence(
    session: GameSessionRecord,
    event: EventTemplate,
  ): Promise<HistoricalEvidence> {
    if (session.content_version === "11.0.0") {
      const allowedSourceIds = new Set(event.evidenceRefs);
      const relevantClaims = changanContent.claims.filter((claim) =>
        claim.sourceIds.some((sourceId) => allowedSourceIds.has(sourceId))
      );
      const claims = relevantClaims.map((claim) => evidenceClaimSchema.parse({
        id: claim.id,
        classification: claim.classification,
        text: claim.textZh,
        sourceIds: claim.sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId)),
      }));
      const sources = changanContent.sources
        .filter((source) => allowedSourceIds.has(source.id))
        .map((source) => evidenceSourceSchema.parse({
          id: source.id,
          title: source.title,
          creator: source.creator,
          locator: source.locator,
          licenseCode: source.licenseCode,
        }));
      const covered = new Set(claims.flatMap((claim) => claim.sourceIds));
      if (
        claims.length === 0
        || sources.length === 0
        || event.evidenceRefs.some((sourceId) => !covered.has(sourceId))
      ) {
        throw new Error(`phase11_evidence_incomplete:${event.eventId}`);
      }
      return { claims, sources };
    }

    const origin = session.character_profile.origin;
    const [claimsResult, sourcesResult] = await Promise.all([
      this.client
        .from("historical_claims")
        .select("id,classification,subject_kind,subject_id,text_zh,source_ids")
        .eq("scenario_id", session.scenario_id)
        .eq("published", true)
        .lte("valid_from", 742)
        .gte("valid_to", 742)
        .order("id"),
      this.client
        .from("historical_sources")
        .select("id,title,creator,locator,license_code")
        .eq("scenario_id", session.scenario_id)
        .eq("published", true)
        .order("id"),
    ]);
    if (claimsResult.error) throw new Error(`evidence_claims_failed:${claimsResult.error.message}`);
    if (sourcesResult.error) throw new Error(`evidence_sources_failed:${sourcesResult.error.message}`);

    const relevantClaims = z.array(claimRowSchema).parse(claimsResult.data ?? []).filter((claim) =>
      claim.subject_kind === "scenario"
      || (claim.subject_kind === "origin" && claim.subject_id === origin)
      || claim.subject_id === "jingzhao-fu"
      || claim.subject_id === "western-market",
    );
    const relevantSourceIds = new Set(relevantClaims.flatMap((claim) => claim.source_ids));
    const sources = z.array(sourceRowSchema).parse(sourcesResult.data ?? [])
      .filter((source) => relevantSourceIds.has(source.id))
      .map((source) => evidenceSourceSchema.parse({
        id: source.id,
        title: source.title,
        creator: source.creator,
        locator: source.locator,
        licenseCode: source.license_code,
      }));
    const claims = relevantClaims.map((claim) => evidenceClaimSchema.parse({
      id: claim.id,
      classification: claim.classification,
      text: claim.text_zh,
      sourceIds: claim.source_ids,
    }));

    if (claims.length === 0 || sources.length === 0) throw new Error("evidence_empty");
    return { claims, sources };
  }

  async loadNarrativeCatalog(session: GameSessionRecord): Promise<NarrativeCatalog> {
    const expectedCatalog = getRuntimeCatalog(session.content_version);
    const [manifestResult, registryResult] = await Promise.all([
      this.client
        .from("scenario_manifests")
        .select("scenario_id,content_version,era_start,era_end,locations,origins,evidence_policy,first_event_by_origin")
        .eq("scenario_id", session.scenario_id)
        .eq("published", true)
        .single(),
      this.client
        .from("event_template_registry")
        .select("event_id,chapter_id,origin_ids,choice_ids,consequence_keys,next_event_ids,evidence_refs,publication_status,runtime_availability,content_version")
        .eq("scenario_id", session.scenario_id)
        .eq("content_version", session.content_version)
        .in("runtime_availability", ["public-beta", "public"])
        .order("event_id"),
    ]);
    if (manifestResult.error) throw new Error(`scenario_manifest_failed:${manifestResult.error.message}`);
    if (registryResult.error) throw new Error(`event_registry_failed:${registryResult.error.message}`);

    const row = manifestRowSchema.parse(manifestResult.data);
    const manifest = scenarioManifestSchema.parse({
      scenarioId: row.scenario_id,
      contentVersion: row.content_version,
      era: { start: row.era_start, end: row.era_end },
      locations: row.locations,
      origins: row.origins,
      evidencePolicy: row.evidence_policy,
      firstEventByOrigin: row.first_event_by_origin,
    });
    if (
      session.content_version === "11.0.0"
      && JSON.stringify(manifest) !== JSON.stringify(expectedCatalog.manifest)
    ) {
      throw new Error("scenario_manifest_drift");
    }

    const registry = z.array(eventRegistryRowSchema).parse(registryResult.data ?? []);
    if (registry.length !== expectedCatalog.events.length) throw new Error("event_registry_incomplete");
    for (const event of expectedCatalog.events) {
      const registered = registry.find((candidate) => candidate.event_id === event.eventId);
      if (!registered) throw new Error(`event_registry_missing:${event.eventId}`);
      const expected = {
        chapter_id: event.chapterId,
        origin_ids: event.originIds,
        choice_ids: event.choices.map((choice) => choice.id),
        consequence_keys: event.choices.map((choice) => choice.consequence.key),
        next_event_ids: event.choices.map((choice) => choice.consequence.nextEventId),
        evidence_refs: event.evidenceRefs,
        content_version: expectedCatalog.manifest.contentVersion,
        publication_status: event.publicationStatus,
        runtime_availability: event.runtimeAvailability,
      };
      for (const [key, value] of Object.entries(expected)) {
        if (JSON.stringify(registered[key as keyof typeof registered]) !== JSON.stringify(value)) {
          throw new Error(`event_registry_drift:${event.eventId}:${key}`);
        }
      }
    }
    return expectedCatalog;
  }

  async createSignedUploadUrl(uploadId: string): Promise<string> {
    const { data, error } = await this.client
      .from("user_uploads")
      .select("storage_path,bucket_id,status")
      .eq("id", uploadId)
      .single();
    if (error) throw new Error(`upload_not_available:${error.message}`);
    const upload = uploadRowSchema.parse(data);

    const { data: signed, error: signedError } = await this.client.storage
      .from(upload.bucket_id)
      .createSignedUrl(upload.storage_path, 60);
    if (signedError) throw new Error(`upload_sign_failed:${signedError.message}`);
    return signed.signedUrl;
  }

  async reserveAiCall(
    clientTurnId: string,
    attempt: 1 | 2,
    limits: AiBudgetLimits,
  ): Promise<AiCallReservation> {
    const { data, error } = await this.serverClient.rpc("reserve_ai_call", {
      p_owner_id: this.userId,
      p_client_turn_id: clientTurnId,
      p_attempt: attempt,
      p_user_daily_limit: limits.userDailyLimit,
      p_global_daily_limit: limits.globalDailyLimit,
    });
    if (error) throw new Error(`ai_budget_reserve_failed:${error.message}`);
    return aiCallReservationSchema.parse(data);
  }

  async completeAiCall(
    clientTurnId: string,
    attempt: 1 | 2,
    resultCode: AiCallResultCode,
    latencyMs: number,
  ): Promise<void> {
    const { data, error } = await this.serverClient.rpc("complete_ai_call", {
      p_owner_id: this.userId,
      p_client_turn_id: clientTurnId,
      p_attempt: attempt,
      p_result_code: resultCode,
      p_latency_ms: Math.max(0, Math.min(300000, Math.round(latencyMs))),
    });
    if (error) throw new Error(`ai_audit_completion_failed:${error.message}`);
    if (data !== true) throw new Error("ai_audit_completion_missing");
  }

  async commitTurn(
    sessionId: string,
    request: TurnRequest,
    generation: TurnGeneration,
    nextState: WorldState,
    providerResponseId: string,
  ): Promise<CommittedTurn> {
    const { data, error } = await this.serverClient.rpc("server_commit_game_turn", {
      p_owner_id: this.userId,
      p_session_id: sessionId,
      p_client_turn_id: request.clientTurnId,
      p_expected_state_version: request.expectedStateVersion,
      p_input: { action: request.action },
      p_narrative: generation,
      p_state_after: nextState,
      p_source_ids: generation.sourceIds,
      p_provider_response_id: providerResponseId,
    });
    if (error) throw new Error(`turn_commit_failed:${error.message}`);
    return committedTurnSchema.parse(data);
  }

  async failTurn(
    sessionId: string,
    clientTurnId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const { error } = await this.serverClient.rpc("server_fail_game_turn", {
      p_owner_id: this.userId,
      p_session_id: sessionId,
      p_client_turn_id: clientTurnId,
      p_failure_code: code,
      p_failure_message: message,
    });
    if (error) throw new Error(`turn_failure_record_failed:${error.message}`);
  }

  async commitSystemAction(
    sessionId: string,
    request: AuthoritativeSystemActionRequest,
    event: AuthoritativeSystemEvent,
    nextState: WorldState,
  ): Promise<CommittedSystemAction> {
    const { data, error } = await this.serverClient.rpc("server_commit_system_action", {
      p_owner_id: this.userId,
      p_session_id: sessionId,
      p_client_action_id: request.clientActionId,
      p_expected_state_version: request.expectedStateVersion,
      p_action_id: request.actionId,
      p_approach: request.approach,
      p_parameters: request.parameters,
      p_event: event,
      p_state_after: nextState,
      p_source_ids: event.sourceIds,
    });
    if (error) throw new Error(`system_action_commit_failed:${error.message}`);
    return committedSystemActionSchema.parse(data);
  }

  async findSystemActionReplay(
    sessionId: string,
    request: AuthoritativeSystemActionRequest,
  ): Promise<CommittedSystemAction | null> {
    const { data, error } = await this.serverClient
      .from("game_system_actions")
      .select("session_id,expected_state_version,action_id,approach,parameters,response_snapshot")
      .eq("owner_id", this.userId)
      .eq("client_action_id", request.clientActionId)
      .maybeSingle();
    if (error) throw new Error(`system_action_replay_failed:${error.message}`);
    if (!data) return null;

    if (
      data.session_id !== sessionId
      || data.expected_state_version !== request.expectedStateVersion
      || data.action_id !== request.actionId
      || data.approach !== request.approach
      || canonicalJson(data.parameters ?? {}) !== canonicalJson(request.parameters)
    ) {
      throw new Error("system_idempotency_mismatch");
    }

    return committedSystemActionSchema.parse({
      ...(data.response_snapshot as Record<string, unknown>),
      duplicate: true,
    });
  }
}
