import { describe, expect, it, vi } from "vitest";
import {
  createPrototypeSavePayload,
  prototypeSaveStorageKey,
  rotateClientSessionId,
} from "./saves";

describe("prototype save payload", () => {
  it("keeps the retry identifier separate from the database id", () => {
    const ownerId = "018f2614-326b-7e67-b42d-0f19cde35dc1";
    const clientSessionId = "018f2614-326b-7e67-b42d-0f19cde35dc2";
    const payload = createPrototypeSavePayload(ownerId, "merchant", clientSessionId);

    expect(payload.owner_id).toBe(ownerId);
    expect(payload.client_session_id).toBe(clientSessionId);
    expect(payload.character_profile).toEqual({ origin: "merchant" });
    expect(payload.world_state.socialIdentity).toBe("merchant");
    expect(payload.state_version).toBe(0);
  });

  it("rejects origins outside the three published templates", () => {
    expect(() => prototypeSaveStorageKey("emperor")).toThrow();
  });

  it("rotates the local client id without deleting the archived server session", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      crypto: { randomUUID: () => "22222222-2222-4222-8222-222222222222" },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const next = rotateClientSessionId("merchant");

    expect(next).toBe("22222222-2222-4222-8222-222222222222");
    expect(values.get(prototypeSaveStorageKey("merchant"))).toBe(next);
    vi.unstubAllGlobals();
  });
});
