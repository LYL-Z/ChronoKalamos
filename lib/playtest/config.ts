export const PHASE14_PLAYTEST = {
  appRelease: "38",
  contentVersion: "11.0.0",
  scenarioId: "tang-changan-742",
  scenarioVersion: "1.0.0",
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
