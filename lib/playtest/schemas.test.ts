import { describe, expect, it } from "vitest";
import {
  clientPlaytestEventSchema,
  playtestEnrollmentSchema,
} from "@/lib/playtest/schemas";

describe("phase 14 playtest schemas", () => {
  it("accepts a bounded recovery event", () => {
    expect(clientPlaytestEventSchema.parse({
      clientEventId: "8c075f47-329e-4aa3-b80f-0243ca5bcfe9",
      eventName: "recovery_attempted",
      gameSessionId: "5739ed97-1e91-4c4b-99d9-88106261494b",
      recoveryPath: "turn_retry",
      resultCode: "retry_requested",
    })).toMatchObject({
      eventName: "recovery_attempted",
      recoveryPath: "turn_retry",
    });
  });

  it("rejects direct identifiers and arbitrary payloads", () => {
    expect(clientPlaytestEventSchema.safeParse({
      clientEventId: "8c075f47-329e-4aa3-b80f-0243ca5bcfe9",
      eventName: "client_error",
      email: "participant@example.com",
      narrative: "raw prose",
    }).success).toBe(false);
  });

  it("requires the fixed 742 CE scenario on enrollment rows", () => {
    expect(playtestEnrollmentSchema.safeParse({
      id: "8c075f47-329e-4aa3-b80f-0243ca5bcfe9",
      owner_id: "5739ed97-1e91-4c4b-99d9-88106261494b",
      app_release: "36",
      content_version: "11.0.0",
      scenario_id: "second-scenario",
      scenario_version: "1.0.0",
      consent_version: "phase14-v1",
      cohort: "small-public-beta",
      consented_at: "2026-07-29T00:00:00.000Z",
      created_at: "2026-07-29T00:00:00.000Z",
    }).success).toBe(false);
  });
});

