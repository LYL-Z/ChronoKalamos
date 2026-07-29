import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error("SUPABASE_TEST_URL/SUPABASE_URL and SUPABASE_TEST_SECRET_KEY/SUPABASE_SECRET_KEY are required");
}

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const context = {
  appRelease: "36",
  contentVersion: "11.0.0",
  scenarioId: "tang-changan-742",
  scenarioVersion: "1.0.0",
};
const thresholds = {
  minimumParticipants: 8,
  minimumPerOrigin: 2,
  medianFirstChoiceMs: 90_000,
  firstTurnRate: 0.8,
  thirdTurnRate: 0.6,
  fifthTurnRate: 0.4,
  failureRate: 0.05,
  p95LatencyMs: 30_000,
  sourceCoverageRate: 1,
};

function rate(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function suppressSmallCells(rows) {
  return rows
    .filter((row) => row.count >= 3)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const { data: enrollments, error: enrollmentError } = await client
  .from("playtest_enrollments")
  .select("id,consented_at")
  .eq("app_release", context.appRelease)
  .eq("content_version", context.contentVersion)
  .eq("scenario_id", context.scenarioId)
  .eq("scenario_version", context.scenarioVersion);
if (enrollmentError) throw enrollmentError;

const { data: events, error: eventError } = await client
  .from("playtest_events")
  .select("enrollment_id,event_name,origin_id,event_id,choice_id,turn_number,latency_ms,result_code,exit_point,recovery_path,source_count,classification,occurred_at")
  .eq("app_release", context.appRelease)
  .eq("content_version", context.contentVersion)
  .eq("scenario_id", context.scenarioId)
  .eq("scenario_version", context.scenarioVersion);
if (eventError) throw eventError;

const publicationGate = JSON.parse(await readFile(
  new URL("../content/tang-changan-742/publication-gate.json", import.meta.url),
  "utf8",
));
const participantCount = enrollments.length;
const eventsByEnrollment = new Map(enrollments.map((row) => [row.id, []]));
for (const event of events) eventsByEnrollment.get(event.enrollment_id)?.push(event);

const firstChoiceTimes = [];
const maxTurnByEnrollment = [];
const origins = new Map();
for (const enrollment of enrollments) {
  const participantEvents = eventsByEnrollment.get(enrollment.id) ?? [];
  const firstStart = participantEvents
    .filter((event) => event.event_name === "session_started")
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];
  const firstChoice = participantEvents
    .filter((event) =>
      event.event_name === "choice_submitted"
      && (!firstStart || event.occurred_at >= firstStart.occurred_at)
    )
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];
  if (firstStart && firstChoice) {
    firstChoiceTimes.push(Math.max(
      0,
      Date.parse(firstChoice.occurred_at) - Date.parse(firstStart.occurred_at),
    ));
  }
  const committed = participantEvents.filter((event) => event.event_name === "turn_committed");
  maxTurnByEnrollment.push(Math.max(0, ...committed.map((event) => event.turn_number ?? 0)));
  const origin = participantEvents.find((event) => event.origin_id)?.origin_id;
  if (origin) origins.set(origin, (origins.get(origin) ?? 0) + 1);
}

const committed = events.filter((event) => event.event_name === "turn_committed");
const failed = events.filter((event) => event.event_name === "turn_failed");
const outcomes = [...committed, ...failed];
const choiceCounts = new Map();
for (const event of committed) {
  if (!event.origin_id || !event.event_id || !event.choice_id) continue;
  const key = `${event.origin_id}:${event.event_id}:${event.choice_id}`;
  choiceCounts.set(key, (choiceCounts.get(key) ?? 0) + 1);
}
const exitParticipants = new Map();
for (const event of events.filter((row) => row.event_name === "player_exit" && row.exit_point)) {
  const participants = exitParticipants.get(event.exit_point) ?? new Set();
  participants.add(event.enrollment_id);
  exitParticipants.set(event.exit_point, participants);
}

const metrics = {
  participants: participantCount,
  startedParticipants: new Set(
    events
      .filter((row) => row.event_name === "session_started")
      .map((row) => row.enrollment_id),
  ).size,
  originCounts: Object.fromEntries([...origins].sort()),
  firstChoice: {
    observed: firstChoiceTimes.length,
    medianMs: percentile(firstChoiceTimes, 0.5),
  },
  completion: {
    firstTurn: rate(maxTurnByEnrollment.filter((turn) => turn >= 1).length, participantCount),
    thirdTurn: rate(maxTurnByEnrollment.filter((turn) => turn >= 3).length, participantCount),
    fifthTurn: rate(maxTurnByEnrollment.filter((turn) => turn >= 5).length, participantCount),
  },
  turns: {
    committed: committed.length,
    failed: failed.length,
    failureRate: rate(failed.length, outcomes.length),
    p50LatencyMs: percentile(outcomes.flatMap((row) => row.latency_ms == null ? [] : [row.latency_ms]), 0.5),
    p95LatencyMs: percentile(outcomes.flatMap((row) => row.latency_ms == null ? [] : [row.latency_ms]), 0.95),
  },
  evidence: {
    covered: committed.filter((row) => (row.source_count ?? 0) > 0).length,
    sourceCoverageRate: rate(
      committed.filter((row) => (row.source_count ?? 0) > 0).length,
      committed.length,
    ),
  },
  branchDistribution: suppressSmallCells(
    [...choiceCounts].map(([key, count]) => ({ key, count })),
  ),
  exitPoints: suppressSmallCells(
    [...exitParticipants].map(([key, participants]) => ({ key, count: participants.size })),
  ),
  errors: failed.reduce((counts, row) => {
    const key = row.result_code ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
  recovery: {
    attempted: events.filter((row) => row.event_name === "recovery_attempted").length,
    completed: events.filter((row) => row.event_name === "recovery_completed").length,
  },
};

const sampleGate = participantCount >= thresholds.minimumParticipants
  && ["merchant", "craft", "clerk"].every((origin) => (origins.get(origin) ?? 0) >= thresholds.minimumPerOrigin);
const experienceGate = sampleGate
  && metrics.firstChoice.medianMs !== null
  && metrics.firstChoice.medianMs <= thresholds.medianFirstChoiceMs
  && metrics.completion.firstTurn !== null
  && metrics.completion.firstTurn >= thresholds.firstTurnRate
  && metrics.completion.thirdTurn !== null
  && metrics.completion.thirdTurn >= thresholds.thirdTurnRate
  && metrics.completion.fifthTurn !== null
  && metrics.completion.fifthTurn >= thresholds.fifthTurnRate
  && metrics.turns.failureRate !== null
  && metrics.turns.failureRate <= thresholds.failureRate
  && metrics.turns.p95LatencyMs !== null
  && metrics.turns.p95LatencyMs <= thresholds.p95LatencyMs;
const historianGate = publicationGate.reviewStatus === "approved"
  && Array.isArray(publicationGate.reviewers)
  && publicationGate.reviewers.length >= 1;
const trustGate = historianGate
  && committed.length > 0
  && metrics.evidence.sourceCoverageRate === thresholds.sourceCoverageRate;

const report = {
  generatedAt: new Date().toISOString(),
  context,
  privacy: {
    smallCellsSuppressedBelow: 3,
    directIdentifiersQueried: false,
  },
  metrics,
  gates: {
    sample: sampleGate ? "pass" : "insufficient_evidence",
    experience: experienceGate ? "pass" : "insufficient_evidence",
    historianReview: historianGate ? "pass" : "pending",
    trust: trustGate ? "pass" : "insufficient_evidence",
    commercialGrade: experienceGate && trustGate ? "pass" : "not_demonstrated",
  },
};

console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--require-pass") && report.gates.commercialGrade !== "pass") {
  process.exitCode = 1;
}
