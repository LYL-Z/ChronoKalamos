import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const testUrl = process.env.SUPABASE_TEST_URL;
const testPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const testSecret = process.env.SUPABASE_TEST_SECRET_KEY;

type TestIdentity = {
  client: SupabaseClient;
  accessToken: string;
  userId: string;
};

async function createAnonymousIdentity(): Promise<TestIdentity> {
  if (!testUrl || !testPublishableKey) throw new Error("Supabase test configuration is missing");
  const client = createClient(testUrl, testPublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session || !data.user) throw error ?? new Error("anonymous_sign_in_failed");
  return { client, accessToken: data.session.access_token, userId: data.user.id };
}

test.describe("Phase 18 authoritative database chain", () => {
  test("commits household through governance atomically, replays idempotently, and isolates owners", async ({ request }) => {
    test.skip(
      !testUrl || !testPublishableKey || !testSecret,
      "SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY and SUPABASE_TEST_SECRET_KEY are required",
    );

    const admin = createClient(testUrl!, testSecret!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const identities: TestIdentity[] = [];
    try {
      const owner = await createAnonymousIdentity();
      const stranger = await createAnonymousIdentity();
      identities.push(owner, stranger);

      const clientSessionId = crypto.randomUUID();
      const { data: rawSession, error: sessionError } = await owner.client.rpc("create_or_get_game_session", {
        p_client_session_id: clientSessionId,
        p_origin_id: "merchant",
      });
      expect(sessionError).toBeNull();
      const session = rawSession as { id: string; state_version: number };
      expect(session.state_version).toBe(0);

      const { data: invalidSessionRaw, error: invalidSessionError } = await owner.client.rpc(
        "create_or_get_game_session",
        { p_client_session_id: crypto.randomUUID(), p_origin_id: "craft" },
      );
      expect(invalidSessionError).toBeNull();
      const invalidSession = invalidSessionRaw as { id: string };
      const rejectedMarriage = await request.post(
        `/api/game-sessions/${invalidSession.id}/system-actions`,
        {
          headers: { Authorization: `Bearer ${owner.accessToken}` },
          data: {
            clientActionId: crypto.randomUUID(),
            expectedStateVersion: 0,
            actionId: "marriage-contract",
            approach: "prudent",
            parameters: { partnerLabel: "未满足前置", partnerAge: 23, mutualConsent: true },
          },
        },
      );
      expect(rejectedMarriage.status()).toBe(422);
      const { data: rejectedSessionState, error: rejectedSessionError } = await owner.client
        .from("game_sessions")
        .select("state_version")
        .eq("id", invalidSession.id)
        .single();
      expect(rejectedSessionError).toBeNull();
      expect(rejectedSessionState?.state_version).toBe(0);

      const { error: directRpcError } = await owner.client.rpc("server_commit_system_action", {
        p_owner_id: owner.userId,
        p_session_id: session.id,
        p_client_action_id: crypto.randomUUID(),
        p_expected_state_version: 0,
        p_action_id: "confirm-adult-age",
        p_approach: "prudent",
        p_parameters: { actorAge: 24 },
        p_event: {},
        p_state_after: {},
        p_source_ids: ["S-001"],
      });
      expect(directRpcError).not.toBeNull();
      expect(directRpcError?.message).toMatch(/permission denied/i);

      let expectedStateVersion = 0;
      const postAction = async (
        actionId: string,
        parameters: Record<string, unknown> = {},
        clientActionId = crypto.randomUUID(),
      ) => {
        const payload = {
          clientActionId,
          expectedStateVersion,
          actionId,
          approach: "prudent",
          parameters,
        };
        const response = await request.post(`/api/game-sessions/${session.id}/system-actions`, {
          headers: { Authorization: `Bearer ${owner.accessToken}` },
          data: payload,
        });
        expect(response.status(), `${actionId}: ${await response.text()}`).toBe(200);
        const body = await response.json() as {
          actionLedgerId: string;
          stateVersion: number;
          duplicate: boolean;
          worldState: Record<string, unknown>;
        };
        expect(body.stateVersion).toBe(expectedStateVersion + 1);
        expectedStateVersion = body.stateVersion;
        return { body, payload };
      };

      await postAction("confirm-adult-age", { actorAge: 24 });
      await postAction("household-care");
      const marriage = await postAction("marriage-contract", {
        partnerLabel: "架空婚约对象",
        partnerAge: 23,
        mutualConsent: true,
      });
      await postAction("register-child-care", { childLabel: "架空照护对象", childAge: 6 });
      await postAction("study-records");
      await postAction("study-records");
      await postAction("case-open");
      await postAction("case-investigate");
      await postAction("case-resolve");
      await postAction("office-appoint");
      await postAction("office-duty");
      await postAction("trade-buy", { itemId: "p17-flatbread-ration" });
      await postAction("trade-sell", { itemId: "p17-flatbread-ration" });
      await postAction("elite-introduction");
      await postAction("elite-council");
      await postAction("governance-accession");
      await postAction("governance-revenue");
      const governance = await postAction("governance-relief", { circuitId: "capital" });

      const systems = (governance.body.worldState.systems ?? {}) as Record<string, Record<string, unknown>>;
      expect(systems.household.marriageStatus).toBe("contracted");
      expect(systems.household.children).toBe(1);
      expect(systems.office.dutyCompleted).toBe(1);
      expect(systems.casework.resolvedCount).toBe(1);
      expect(systems.commerce.completedTrades).toBe(2);
      expect(systems.eliteNetwork.councilAccess).toBe(true);
      expect(systems.governance.access).toBe(true);
      expect(systems.governance.reviewedCircuits).toContain("capital");

      const replay = await request.post(`/api/game-sessions/${session.id}/system-actions`, {
        headers: { Authorization: `Bearer ${owner.accessToken}` },
        data: marriage.payload,
      });
      expect(replay.status(), await replay.text()).toBe(200);
      const replayBody = await replay.json() as { actionLedgerId: string; stateVersion: number; duplicate: boolean };
      expect(replayBody.actionLedgerId).toBe(marriage.body.actionLedgerId);
      expect(replayBody.stateVersion).toBe(marriage.body.stateVersion);
      expect(replayBody.duplicate).toBe(true);

      const { count: ownerCount, error: ownerReadError } = await owner.client
        .from("game_system_actions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      expect(ownerReadError).toBeNull();
      expect(ownerCount).toBe(18);

      const { count: checkpointCount, error: checkpointError } = await owner.client
        .from("game_checkpoints")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      expect(checkpointError).toBeNull();
      // Session creation records v0; the 18 committed actions add v1 through v18.
      expect(checkpointCount).toBe(19);
      const { data: committedSession, error: committedSessionError } = await owner.client
        .from("game_sessions")
        .select("state_version")
        .eq("id", session.id)
        .single();
      expect(committedSessionError).toBeNull();
      expect(committedSession?.state_version).toBe(18);

      const { count: strangerCount, error: strangerReadError } = await stranger.client
        .from("game_system_actions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      expect(strangerReadError).toBeNull();
      expect(strangerCount).toBe(0);

      const { error: directWriteError } = await owner.client.from("game_system_actions").insert({
        session_id: session.id,
        owner_id: owner.userId,
        client_action_id: crypto.randomUUID(),
        expected_state_version: expectedStateVersion,
        committed_state_version: expectedStateVersion + 1,
        action_id: "household-care",
        approach: "prudent",
        parameters: {},
        event: {},
        state_before: {},
        state_after: {},
        source_ids: ["S-001"],
      });
      expect(directWriteError).not.toBeNull();
    } finally {
      const cleanupErrors: string[] = [];
      for (const identity of identities) {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 4; attempt += 1) {
          const { error } = await admin.auth.admin.deleteUser(identity.userId);
          if (!error) {
            lastError = null;
            break;
          }
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
        if (lastError) cleanupErrors.push(`${identity.userId}: ${lastError.message}`);
      }
      expect(cleanupErrors, "all temporary identities must be removed").toEqual([]);
    }
  });
});
