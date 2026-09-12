import release from "@/lib/playtest/release.json";

export const PHASE14_PLAYTEST = {
  appRelease: release.appRelease,
  contentVersion: release.contentVersion,
  scenarioId: release.scenarioId,
  scenarioVersion: release.scenarioVersion,
  editionLabel: release.editionLabel,
  consentVersion: "phase14-v1",
  cohort: "small-public-beta",
  retentionDays: 30,
} as const;

export const PHASE14_THRESHOLDS = {
  minimumParticipants: 8,
  maximumParticipants: 20,
  minimumParticipantsPerOrigin: 2,
  medianFirstChoiceMs: 90_000,
  firstTurnCompletionRate: 0.8,
  thirdTurnCompletionRate: 0.6,
  fifthTurnCompletionRate: 0.4,
  turnFailureRate: 0.05,
  p95TurnLatencyMs: 30_000,
  sourceCoverageRate: 1,
  minimumHistorianReviews: 1,
} as const;
