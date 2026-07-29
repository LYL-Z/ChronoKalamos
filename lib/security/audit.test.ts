import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSecurityAudit } from "./audit";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("privacy-safe security audit", () => {
  it("pseudonymizes actors and emits no raw identifier", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const actorId = "018f2614-326b-7e67-b42d-0f19cde35dc3";

    await writeSecurityAudit({
      event: "turn.failed",
      outcome: "failed",
      requestId: "018f2614-326b-7e67-b42d-0f19cde35dc2",
      actorId,
      code: "model_timeout",
    }, {
      SECURITY_AUDIT_SALT: "test-only-salt",
    });

    const serialized = String(info.mock.calls[0]?.[0]);
    const record = JSON.parse(serialized) as Record<string, unknown>;
    expect(serialized).not.toContain(actorId);
    expect(record).toMatchObject({
      service: "chronokalamos",
      event: "turn.failed",
      outcome: "failed",
      code: "model_timeout",
    });
    expect(record.actorHash).toMatch(/^[0-9a-f]{24}$/);
  });

  it("omits the actor field when no audit salt is configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await writeSecurityAudit({
      event: "turn.started",
      outcome: "allowed",
      requestId: "request-1",
      actorId: "actor-1",
    }, {});

    const record = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record.actorHash).toBeUndefined();
  });
});
