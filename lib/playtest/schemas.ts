import { z } from "zod";

export const playtestEventNameSchema = z.enum([
  "session_started",
  "choice_submitted",
  "turn_committed",
  "turn_failed",
  "recovery_attempted",
  "recovery_completed",
  "client_error",
  "player_exit",
]);

export const clientPlaytestEventSchema = z.object({
  clientEventId: z.string().uuid(),
  eventName: z.enum([
    "session_started",
    "recovery_attempted",
    "recovery_completed",
    "client_error",
    "player_exit",
  ]),
  gameSessionId: z.string().uuid().nullable().optional(),
  exitPoint: z.enum([
    "setup_closed",
    "game_back_home",
    "page_hidden",
    "save_restore_failed",
  ]).nullable().optional(),
  recoveryPath: z.enum([
    "turn_retry",
    "save_restore",
    "network_reconnect",
  ]).nullable().optional(),
  resultCode: z.string().regex(/^[a-z0-9_:-]{1,64}$/).nullable().optional(),
}).strict();

export const playtestEnrollmentSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  app_release: z.string(),
  content_version: z.string(),
  scenario_id: z.literal("tang-changan-742"),
  scenario_version: z.string(),
  consent_version: z.string(),
  cohort: z.string(),
  consented_at: z.string(),
  created_at: z.string(),
}).passthrough();

export type ClientPlaytestEvent = z.infer<typeof clientPlaytestEventSchema>;
export type PlaytestEnrollment = z.infer<typeof playtestEnrollmentSchema>;
export type PlaytestEventName = z.infer<typeof playtestEventNameSchema>;

