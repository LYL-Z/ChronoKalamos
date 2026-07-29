import { z } from "zod";

export const aiBudgetLimitsSchema = z.object({
  userDailyLimit: z.number().int().min(1).max(1000),
  globalDailyLimit: z.number().int().min(1).max(100000),
});

export type AiBudgetLimits = z.infer<typeof aiBudgetLimitsSchema>;

export const aiCallReservationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("reserved"),
    userDailyCount: z.number().int().positive(),
    globalDailyCount: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("duplicate"),
  }),
  z.object({
    status: z.literal("user_daily_limit"),
    userDailyCount: z.number().int().nonnegative(),
    globalDailyCount: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal("global_daily_limit"),
    globalDailyCount: z.number().int().nonnegative(),
  }),
]);

export type AiCallReservation = z.infer<typeof aiCallReservationSchema>;

export type AiCallResultCode =
  | "success"
  | "model_failed"
  | "model_timeout"
  | "model_refusal"
  | "image_not_supported"
  | "validation_failed"
  | "unexpected_failure";

export function aiTurnsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.AI_TURNS_ENABLED?.trim().toLowerCase() !== "false";
}

function positiveInteger(raw: string | undefined, fallback: number, max: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) return fallback;
  return parsed;
}

export function getAiBudgetLimits(
  env: Record<string, string | undefined> = process.env,
): AiBudgetLimits {
  const userDailyLimit = positiveInteger(env.AI_DAILY_USER_LIMIT, 40, 1000);
  const globalDailyLimit = positiveInteger(env.AI_DAILY_GLOBAL_LIMIT, 500, 100000);
  return aiBudgetLimitsSchema.parse({
    userDailyLimit: Math.min(userDailyLimit, globalDailyLimit),
    globalDailyLimit,
  });
}
