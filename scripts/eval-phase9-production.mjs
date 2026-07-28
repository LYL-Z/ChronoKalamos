import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const apiBase = process.env.PHASE9_PRODUCTION_URL ?? "https://chronokalamos.com";
const enabled = process.env.PHASE9_PRODUCTION_ACCEPTANCE === "1";
const requestedOrigin = process.argv.find((argument) => argument.startsWith("--origin="))
  ?.slice("--origin=".length);

assert.ok(enabled, "Set PHASE9_PRODUCTION_ACCEPTANCE=1 to run production acceptance.");
assert.ok(supabaseUrl && publishableKey, "Supabase test configuration is missing.");

const plans = [
  {
    id: "merchant",
    name: "phase9-merchant",
    temperament: "谨慎",
    firstAction: "先核对账纸与封记，再询问家人今日来客。",
  },
  {
    id: "craft",
    name: "phase9-craft",
    temperament: "好奇",
    firstAction: "先检查材料和工序，再确认今日交付期限。",
  },
  {
    id: "clerk",
    name: "phase9-clerk",
    temperament: "克制",
    firstAction: "先核对文书中的地名，再确认递送范围。",
  },
];

const selectedPlans = requestedOrigin
  ? plans.filter((plan) => plan.id === requestedOrigin)
  : plans;

assert.ok(selectedPlans.length > 0, "Unknown --origin value.");

function parseSse(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((frame) => {
      const event = frame.match(/^event:\s*(.+)$/m)?.[1];
      const data = frame.match(/^data:\s*(.+)$/m)?.[1];
      return event && data ? { event, data: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

async function runOrigin(plan) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const evidence = {
    origin: plan.id,
    profilePersisted: false,
    turns: [],
    cleaned: false,
  };
  let sessionId;

  try {
    const { data: auth, error: authError } = await client.auth.signInAnonymously({
      options: {
        data: {
          chronokalamos_phase9_acceptance: crypto.randomUUID(),
        },
      },
    });
    assert.ifError(authError);
    assert.ok(auth.session?.access_token && auth.user?.id);

    const { data: session, error: sessionError } = await client.rpc(
      "create_or_get_game_session",
      {
        p_client_session_id: crypto.randomUUID(),
        p_origin_id: plan.id,
      },
    );
    assert.ifError(sessionError);
    assert.ok(session?.id);
    sessionId = session.id;

    const profile = {
      origin: plan.id,
      name: plan.name,
      gender: "unspecified",
      temperament: plan.temperament,
    };
    const { error: profileError } = await client.rpc(
      "update_game_character_profile",
      {
        p_session_id: sessionId,
        p_profile: profile,
      },
    );
    assert.ifError(profileError);

    const { data: stored, error: storedError } = await client
      .from("game_sessions")
      .select("character_profile,state_version")
      .eq("id", sessionId)
      .single();
    assert.ifError(storedError);
    assert.deepEqual(stored.character_profile, profile);
    evidence.profilePersisted = true;

    let stateVersion = stored.state_version;
    let actionText = plan.firstAction;
    for (let turn = 1; turn <= 3; turn += 1) {
      const startedAt = Date.now();
      const response = await fetch(
        `${apiBase}/api/game-sessions/${sessionId}/turns`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${auth.session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            clientTurnId: crypto.randomUUID(),
            expectedStateVersion: stateVersion,
            action: {
              kind: "choice",
              choiceId: "choice-1",
              text: actionText,
            },
          }),
        },
      );
      assert.equal(response.status, 200);

      const events = parseSse(await response.text());
      const failure = events.find((event) => event.event === "turn.failed");
      assert.equal(
        failure,
        undefined,
        failure
          ? `${plan.id} turn ${turn}: ${failure.data.code} ${failure.data.message}`
          : "Unexpected turn failure.",
      );

      const committed = events.find(
        (event) => event.event === "state.committed",
      );
      const choices = events.find(
        (event) => event.event === "choices.ready",
      );
      assert.ok(committed, `${plan.id} turn ${turn} did not commit.`);
      assert.ok(
        choices
          && choices.data.choices.length >= 3
          && choices.data.sourceIds.length >= 1,
        `${plan.id} turn ${turn} lacks bounded choices or evidence.`,
      );
      assert.equal(committed.data.stateVersion, stateVersion + 1);
      assert.equal(committed.data.worldState.time.turn, turn);

      stateVersion = committed.data.stateVersion;
      actionText = choices.data.choices[0].label;
      evidence.turns.push({
        turn,
        stateVersion,
        elapsedMs: Date.now() - startedAt,
        classification: choices.data.classification,
        sourceCount: choices.data.sourceIds.length,
        choiceCount: choices.data.choices.length,
      });
      process.stdout.write(
        `${plan.id} turn ${turn} committed at version ${stateVersion}\n`,
      );
    }

    const { data: turns, error: turnsError } = await client
      .from("game_turns")
      .select("committed_state_version,source_ids")
      .eq("session_id", sessionId)
      .order("committed_state_version");
    assert.ifError(turnsError);
    assert.equal(turns.length, 3);
    assert.ok(turns.every((turn) => turn.source_ids.length >= 1));
    return evidence;
  } finally {
    if (sessionId) {
      const { data: deleted, error: deleteError } = await client.rpc(
        "delete_game_session",
        { p_session_id: sessionId },
      );
      assert.ifError(deleteError);
      assert.equal(deleted, true);
      evidence.cleaned = true;
    }
    await client.auth.signOut();
  }
}

const results = [];
for (const plan of selectedPlans) {
  results.push(await runOrigin(plan));
}

process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
