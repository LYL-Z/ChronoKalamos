import { describe, expect, it } from "vitest";
import { createPrototypeSavePayload, prototypeSaveStorageKey } from "./saves";

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
});

