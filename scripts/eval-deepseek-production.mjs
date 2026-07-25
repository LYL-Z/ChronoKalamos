import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const siteUrl = (process.env.CHRONOKALAMOS_EVAL_URL || "https://chronokalamos.com").replace(/\/+$/, "");
const turnsArgument = process.argv.find((argument) => argument.startsWith("--turns="));
const originArgument = process.argv.find((argument) => argument.startsWith("--origin="));
const turnsPerOrigin = Number(turnsArgument?.split("=")[1] || 20);
const origins = originArgument
  ? [originArgument.split("=")[1]]
  : ["merchant", "craft", "clerk"];

if (!supabaseUrl || !publishableKey) {
  throw new Error("SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are required.");
}
if (!Number.isInteger(turnsPerOrigin) || turnsPerOrigin < 1 || turnsPerOrigin > 20) {
  throw new Error("--turns must be an integer from 1 to 20.");
}
if (origins.some((origin) => !["merchant", "craft", "clerk"].includes(origin))) {
  throw new Error("--origin must be merchant, craft, or clerk.");
}

const actions = [
  "观察周围的人流与店铺，辨认与自己身份相关的日常线索。",
  "向熟悉的家人或同伴询问今天应完成的本分工作。",
  "整理随身物品，并确认接下来一刻钟内可以完成的行动。",
  "留意附近人的谈话，但不越过自己的身份与礼法边界。",
  "沿熟悉的道路短暂行走，确认周围环境与今日秩序。",
];

function parseSse(payload) {
  const events = [];
  for (const frame of payload.replace(/\r\n/g, "\n").split("\n\n")) {
    if (!frame.trim()) continue;
    let event = "";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (event && data) events.push({ event, data: JSON.parse(data) });
  }
  return events;
}

async function submitTurn(accessToken, sessionId, request) {
  const startedAt = performance.now();
  const response = await fetch(`${siteUrl}/api/game-sessions/${encodeURIComponent(sessionId)}/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(70_000),
  });
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let payload = "";
  let transportError = null;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        payload += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        if (done) break;
      }
    } catch (error) {
      transportError = error instanceof Error ? error.message : "stream_terminated";
    }
  }
  const events = parseSse(payload);
  return {
    status: response.status,
    latencyMs: Math.round(performance.now() - startedAt),
    events,
    transportError,
  };
}

async function evaluateOrigin(client, accessToken, publishedSourceIds, origin) {
  const { data: session, error: sessionError } = await client.rpc("create_or_get_game_session", {
    p_client_session_id: crypto.randomUUID(),
    p_origin_id: origin,
  });
  if (sessionError || !session?.id) throw sessionError || new Error(`Session creation failed for ${origin}`);

  const turnMetrics = [];
  let stateVersion = 0;
  let firstRequest = null;

  try {
    for (let turnIndex = 0; turnIndex < turnsPerOrigin; turnIndex += 1) {
      const request = {
        clientTurnId: crypto.randomUUID(),
        expectedStateVersion: stateVersion,
        action: {
          kind: "free_text",
          text: actions[turnIndex % actions.length],
        },
      };
      if (turnIndex === 0) firstRequest = request;
      const result = await submitTurn(accessToken, session.id, request);
      const failed = result.events.find((event) => event.event === "turn.failed");
      const committed = result.events.find((event) => event.event === "state.committed");

      if (result.status !== 200 || failed || !committed) {
        turnMetrics.push({
          turn: turnIndex + 1,
          status: "failed",
          latencyMs: result.latencyMs,
          code: failed?.data?.code || `http_${result.status}`,
          message: failed?.data?.message || result.transportError || "state.committed missing",
        });
        break;
      }

      const ready = result.events.find((event) => event.event === "choices.ready");
      stateVersion = committed.data.stateVersion;
      const sourceIds = ready?.data?.sourceIds || [];
      turnMetrics.push({
        turn: turnIndex + 1,
        status: "committed",
        latencyMs: result.latencyMs,
        stateVersion,
        worldYear: committed.data.worldState?.time?.year,
        worldTurn: committed.data.worldState?.time?.turn,
        choiceCount: ready?.data?.choices?.length || 0,
        classification: ready?.data?.classification || null,
        sourceIds,
        sourcesPublished: sourceIds.length > 0 && sourceIds.every((id) => publishedSourceIds.has(id)),
      });
    }

    let duplicatePassed = false;
    if (stateVersion > 0 && firstRequest) {
      const duplicate = await submitTurn(accessToken, session.id, firstRequest);
      const duplicateCommit = duplicate.events.find((event) => event.event === "state.committed");
      duplicatePassed = Boolean(
        duplicateCommit?.data?.duplicate
        && duplicateCommit.data.stateVersion === 1,
      );
    }

    const [{ data: sessionAfter, error: sessionAfterError }, { data: turnRows, error: turnRowsError }] = await Promise.all([
      client.from("game_sessions").select("state_version,world_state").eq("id", session.id).single(),
      client.from("game_turns").select("provider,committed_state_version").eq("session_id", session.id),
    ]);
    if (sessionAfterError) throw sessionAfterError;
    if (turnRowsError) throw turnRowsError;

    return {
      origin,
      sessionId: session.id,
      turnsRequested: turnsPerOrigin,
      turnsCommitted: turnMetrics.filter((turn) => turn.status === "committed").length,
      finalStateVersion: sessionAfter.state_version,
      finalWorldTurn: sessionAfter.world_state?.time?.turn,
      duplicatePassed,
      databaseTurnCount: turnRows.length,
      providers: [...new Set(turnRows.map((row) => row.provider))],
      turns: turnMetrics,
    };
  } finally {
    await client.rpc("delete_game_session", { p_session_id: session.id });
  }
}

const client = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const runId = crypto.randomUUID();
const { data: auth, error: authError } = await client.auth.signInAnonymously({
  options: { data: { chronokalamos_deepseek_eval: runId } },
});
if (authError || !auth.session?.access_token) {
  throw authError || new Error("Anonymous sign-in failed.");
}

const { data: publishedSources, error: sourcesError } = await client
  .from("historical_sources")
  .select("id")
  .eq("scenario_id", "tang-changan-742")
  .eq("published", true);
if (sourcesError) throw sourcesError;
const publishedSourceIds = new Set(publishedSources.map((source) => source.id));

const startedAt = new Date();
const results = await Promise.all(
  origins.map((origin) => evaluateOrigin(client, auth.session.access_token, publishedSourceIds, origin)),
);
const finishedAt = new Date();
const allTurns = results.flatMap((result) => result.turns);
const committedTurns = allTurns.filter((turn) => turn.status === "committed");
const failedTurns = allTurns.filter((turn) => turn.status === "failed");

const summary = {
  runId,
  siteUrl,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  requestedModelTurns: turnsPerOrigin * origins.length,
  committedModelTurns: committedTurns.length,
  failedModelTurns: failedTurns.length,
  meanLatencyMs: committedTurns.length
    ? Math.round(committedTurns.reduce((sum, turn) => sum + turn.latencyMs, 0) / committedTurns.length)
    : null,
  maxLatencyMs: committedTurns.length
    ? Math.max(...committedTurns.map((turn) => turn.latencyMs))
    : null,
  sourceValidationPassed: committedTurns.every((turn) => turn.sourcesPublished),
  stateValidationPassed: committedTurns.every((turn) => (
    turn.worldYear === 742
    && turn.worldTurn === turn.stateVersion
    && turn.choiceCount >= 3
    && turn.choiceCount <= 5
  )),
  duplicateValidationPassed: results.every((result) => result.duplicatePassed),
  providerValidationPassed: results.every((result) => (
    result.providers.length === 1
    && result.providers[0] === "deepseek-chat"
  )),
  results,
};

const outputDirectory = new URL("../audit/phase5-deepseek-eval/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL("summary.json", outputDirectory),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  requestedModelTurns: summary.requestedModelTurns,
  committedModelTurns: summary.committedModelTurns,
  failedModelTurns: summary.failedModelTurns,
  meanLatencyMs: summary.meanLatencyMs,
  maxLatencyMs: summary.maxLatencyMs,
  sourceValidationPassed: summary.sourceValidationPassed,
  stateValidationPassed: summary.stateValidationPassed,
  duplicateValidationPassed: summary.duplicateValidationPassed,
  providerValidationPassed: summary.providerValidationPassed,
  failures: failedTurns.map(({ turn, code, message }) => ({ turn, code, message })),
}, null, 2));

if (
  summary.committedModelTurns !== summary.requestedModelTurns
  || !summary.sourceValidationPassed
  || !summary.stateValidationPassed
  || !summary.duplicateValidationPassed
  || !summary.providerValidationPassed
) {
  process.exitCode = 1;
}
