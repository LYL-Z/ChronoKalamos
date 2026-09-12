import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { streamGameTurn } from "./client";
import type { TurnStreamEvent } from "./schemas";

const request = {
  clientTurnId: "11111111-1111-4111-8111-111111111111",
  expectedStateVersion: 0,
  action: { kind: "choice" as const, choiceId: "choice-1" as const, text: "逐项核对账纸与货样" },
};

function fakeClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token" } }, error: null }),
    },
  } as never;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("turn stream client", () => {
  it("delivers a 401 turn.failed frame instead of dropping the body", async () => {
    const body = [
      "event: turn.failed",
      "data: {\"code\":\"unauthorized\",\"message\":\"本回合未提交。\",\"retryable\":true,\"notCommitted\":true}",
      "",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", async () => new Response(body, {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    }));

    const events: TurnStreamEvent[] = [];
    await streamGameTurn({
      client: fakeClient(),
      sessionId: "session-1",
      request,
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual([
      expect.objectContaining({
        event: "turn.failed",
        data: expect.objectContaining({ notCommitted: true, message: "本回合未提交。" }),
      }),
    ]);
  });

  it("throws only when a 4xx response has no stream frames", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 413,
      body: null,
    }));

    await expect(streamGameTurn({
      client: fakeClient(),
      sessionId: "session-1",
      request,
      onEvent: () => undefined,
    })).rejects.toThrow(/HTTP 413/);
  });
});
