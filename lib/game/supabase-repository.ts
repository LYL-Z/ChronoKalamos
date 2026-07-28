import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  committedTurnSchema,
  evidenceClaimSchema,
  evidenceSourceSchema,
  originIdSchema,
  scenarioManifestSchema,
  type CommittedTurn,
  type EvidenceClaim,
  type EvidenceSource,
  type EventTemplate,
  type ScenarioManifest,
  type TurnGeneration,
  type TurnRequest,
  type WorldState,
} from "@/lib/game/schemas";
import { phase10EventTemplates, phase10ScenarioManifest } from "@/lib/game/event-catalog";

const sessionSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  scenario_id: z.literal("tang-changan-742"),
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
  publication_status: z.literal("published"),
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
  retrieveEvidence(session: GameSessionRecord): Promise<HistoricalEvidence>;
  createSignedUploadUrl(uploadId: string): Promise<string>;
  commitTurn(
    sessionId: string,
    request: TurnRequest,
    generation: TurnGeneration,
    nextState: WorldState,
    providerResponseId: string,
  ): Promise<CommittedTurn>;
  failTurn(sessionId: string, clientTurnId: string, code: string, message: string): Promise<void>;
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
      .select("id,owner_id,scenario_id,character_profile,world_state,status,state_version")
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

  async retrieveEvidence(session: GameSessionRecord): Promise<HistoricalEvidence> {
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
    const [manifestResult, registryResult] = await Promise.all([
      this.client
        .from("scenario_manifests")
        .select("scenario_id,content_version,era_start,era_end,locations,origins,evidence_policy,first_event_by_origin")
        .eq("scenario_id", session.scenario_id)
        .eq("published", true)
        .single(),
      this.client
        .from("event_template_registry")
        .select("event_id,chapter_id,origin_ids,choice_ids,consequence_keys,next_event_ids,evidence_refs,publication_status,content_version")
        .eq("scenario_id", session.scenario_id)
        .eq("publication_status", "published")
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
    if (JSON.stringify(manifest) !== JSON.stringify(phase10ScenarioManifest)) {
      throw new Error("scenario_manifest_drift");
    }

    const registry = z.array(eventRegistryRowSchema).parse(registryResult.data ?? []);
    if (registry.length !== phase10EventTemplates.length) throw new Error("event_registry_incomplete");
    for (const event of phase10EventTemplates) {
      const registered = registry.find((candidate) => candidate.event_id === event.eventId);
      if (!registered) throw new Error(`event_registry_missing:${event.eventId}`);
      const expected = {
        chapter_id: event.chapterId,
        origin_ids: event.originIds,
        choice_ids: event.choices.map((choice) => choice.id),
        consequence_keys: event.choices.map((choice) => choice.consequence.key),
        next_event_ids: event.choices.map((choice) => choice.consequence.nextEventId),
        evidence_refs: event.evidenceRefs,
        content_version: manifest.contentVersion,
      };
      for (const [key, value] of Object.entries(expected)) {
        if (JSON.stringify(registered[key as keyof typeof registered]) !== JSON.stringify(value)) {
          throw new Error(`event_registry_drift:${event.eventId}:${key}`);
        }
      }
    }
    return { manifest, events: phase10EventTemplates };
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
}
