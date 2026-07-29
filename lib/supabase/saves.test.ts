import { describe, expect, it, vi } from "vitest";
import {
  createPrototypeSavePayload,
  getOwnGameSession,
  prototypeSaveStorageKey,
  rotateClientSessionId,
} from "./saves";
import { createInitialWorldState } from "@/lib/game/rules";

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

  it("loads one owned session through the RLS-filtered browser client", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const single = vi.fn().mockResolvedValue({
      data: {
        id,
        client_session_id: "33333333-3333-4333-8333-333333333333",
        scenario_id: "tang-changan-742",
        content_version: "11.0.0",
        title: "西市粟特商户家庭后辈",
        status: "active",
        state_version: 2,
        updated_at: new Date().toISOString(),
        world_state: createInitialWorldState("merchant"),
        character_profile: {
          origin: "merchant",
          name: "安延",
          gender: "unspecified",
          temperament: "谨慎",
        },
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    };

    const session = await getOwnGameSession(client as never, id);

    expect(client.from).toHaveBeenCalledWith("game_sessions");
    expect(eq).toHaveBeenCalledWith("id", id);
    expect(session.id).toBe(id);
    expect(session.character_profile?.name).toBe("安延");
  });
});
