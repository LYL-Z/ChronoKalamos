import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
const upgradeEmail = process.env.SUPABASE_TEST_UPGRADE_EMAIL;

async function deleteSessionWithTransientRetry(client, sessionId) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await client.rpc("delete_game_session", { p_session_id: sessionId });
    if (!result.error) return result.data;
    lastError = result.error;
    if (!/fetch failed|socket/i.test(`${result.error.message} ${result.error.details ?? ""}`)) {
      throw result.error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw lastError;
}

describe("Supabase live integration", { concurrency: 3 }, () => {
test("phase 4 historical content is public-read and draft-hidden", {
  skip: !url || !publishableKey ? "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are not configured" : false,
  timeout: 90_000,
}, async () => {
  const publicClient = createClient(url, publishableKey, { auth: { persistSession: false, detectSessionInUrl: false } });
  const { data: sources, error: sourcesError } = await publicClient
    .from("historical_sources")
    .select("id,published")
    .eq("scenario_id", "tang-changan-742")
    .eq("published", true);
  assert.ifError(sourcesError);
  assert.equal(sources?.length, 12);
  assert.ok(sources?.every((source) => source.published));

  const { data: claims, error: claimsError } = await publicClient
    .from("historical_claims")
    .select("id,classification,published")
    .eq("scenario_id", "tang-changan-742")
    .eq("published", true);
  assert.ifError(claimsError);
  assert.equal(claims?.length, 13);
  assert.ok(claims?.some((claim) => claim.classification === "史料记载"));
  assert.ok(claims?.some((claim) => claim.classification === "合理重建"));
  assert.ok(claims?.some((claim) => claim.classification === "叙事虚构"));

  const { data: mapFeatures, error: mapError } = await publicClient
    .from("map_features")
    .select("id,valid_from,valid_to,uncertainty_code,license_code")
    .eq("scenario_id", "tang-changan-742")
    .eq("published", true);
  assert.ifError(mapError);
  assert.equal(mapFeatures?.length, 5);
  assert.ok(mapFeatures?.every((feature) => feature.valid_from <= 742 && feature.valid_to >= 742));
  assert.ok(mapFeatures?.every((feature) => feature.uncertainty_code && feature.license_code));

  const { data: origins, error: originsError } = await publicClient
    .from("historical_origins")
    .select("id,code,source_ids,claim_ids,published")
    .eq("scenario_id", "tang-changan-742")
    .eq("published", true)
    .order("code");
  assert.ifError(originsError);
  assert.deepEqual(origins?.map((origin) => origin.code), ["O-01", "O-02", "O-03"]);
  assert.ok(origins?.every((origin) => origin.source_ids.length > 0 && origin.claim_ids.length > 0));

  const { data: originSources, error: originSourcesError } = await publicClient
    .from("historical_origin_sources")
    .select("origin_id,source_id");
  assert.ifError(originSourcesError);
  assert.equal(originSources?.length, 8);

  const { data: hiddenOrigins, error: hiddenOriginsError } = await publicClient
    .from("historical_origins")
    .select("id")
    .eq("published", false);
  assert.ifError(hiddenOriginsError);
  assert.deepEqual(hiddenOrigins, []);

  const { data: hiddenDrafts, error: draftError } = await publicClient
    .from("historical_claims")
    .select("id")
    .eq("published", false);
  assert.ifError(draftError);
  assert.deepEqual(hiddenDrafts, []);

  const { error: writeError } = await publicClient
    .from("historical_claims")
    .insert({ id: "C-TEST-ANON", classification: "叙事虚构", subject_kind: "scenario", subject_id: "tang-changan-742", text_zh: "不应写入", text_en: "must not write", source_ids: [], source_note: "test", valid_from: 742, valid_to: 742, published: true });
  assert.ok(writeError, "public clients must not write historical claims");

  const { error: originWriteError } = await publicClient
    .from("historical_origins")
    .insert({ id: "merchant", code: "O-01", title: "不应写入", english: "must not write", detail: "test", classification: "叙事虚构", source_ids: [], claim_ids: [], published: true });
  assert.ok(originWriteError, "public clients must not write historical origins");
});

test("two users are isolated and an optional controlled email can exercise guest upgrade", {
  skip: !url || !publishableKey ? "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are not configured" : false,
  timeout: 240_000,
}, async () => {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const userA = createClient(url, publishableKey, options);
  const userB = createClient(url, publishableKey, options);
  const serverClient = secretKey ? createClient(url, secretKey, options) : null;
  const runId = crypto.randomUUID();
  const testMetadata = { chronokalamos_test_run: runId };
  const { data: authA, error: authAError } = await userA.auth.signInAnonymously({ options: { data: testMetadata } });
  const { data: authB, error: authBError } = await userB.auth.signInAnonymously({ options: { data: testMetadata } });
  assert.ifError(authAError);
  assert.ifError(authBError);
  assert.ok(authA.user);
  assert.ok(authB.user);

  const clientSessionId = crypto.randomUUID();
  let saveId;
  let saveBId;
  let uploadPath;
  let uploadId;
  let upgradedUser = userA;

  try {
    for (const [client, ownerId] of [[userA, authA.user.id], [userB, authB.user.id]]) {
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("id")
        .eq("id", ownerId)
        .single();
      assert.ifError(profileError);
      assert.equal(profile?.id, ownerId, "the auth trigger must create an owner profile");
    }

    const { data: saveA, error: createError } = await userA.rpc("create_or_get_game_session", {
      p_client_session_id: clientSessionId,
      p_origin_id: "merchant",
    });
    assert.ifError(createError);
    assert.ok(saveA?.id);
    saveId = saveA.id;
    assert.equal(saveA.state_version, 0);
    assert.equal(saveA.world_state?.time?.year, 742);
    assert.equal(saveA.world_state?.socialIdentity, "merchant");

    const { data: retryResult, error: retryError } = await userA.rpc("create_or_get_game_session", {
      p_client_session_id: clientSessionId,
      p_origin_id: "merchant",
    });
    assert.ifError(retryError);
    assert.equal(retryResult?.id, saveId, "session creation must be idempotent");
    assert.equal(retryResult?.state_version, 0);

    const { data: saveB, error: createBError } = await userB.rpc("create_or_get_game_session", {
      p_client_session_id: crypto.randomUUID(),
      p_origin_id: "craft",
    });
    assert.ifError(createBError);
    assert.ok(saveB?.id);
    saveBId = saveB.id;

    const { data: invisibleToB, error: readError } = await userB
      .from("game_sessions")
      .select("id")
      .eq("id", saveId);
    assert.ifError(readError);
    assert.deepEqual(invisibleToB, []);

    const { data: attemptedUpdate, error: updateError } = await userB
      .from("game_sessions")
      .update({ title: "cross-user overwrite" })
      .eq("id", saveId)
      .select("id");
    assert.ok(updateError, "direct session writes must be revoked");
    assert.equal(attemptedUpdate, null);

    const turnInput = {
      action: {
        kind: "free_text",
        text: "观察西市今日货物，并向家人询问来往商旅。",
      },
    };
    const clientTurnId = crypto.randomUUID();
    const { data: reservation, error: reservationError } = await userA.rpc("reserve_game_turn", {
      p_session_id: saveId,
      p_client_turn_id: clientTurnId,
      p_expected_state_version: 0,
      p_input: turnInput,
    });
    assert.ifError(reservationError);
    assert.equal(reservation?.status, "reserved");

    const stateAfter = structuredClone(saveA.world_state);
    stateAfter.time = {
      ...stateAfter.time,
      minuteOfDay: 370,
      totalMinutes: 10,
      turn: 1,
    };
    const narrative = {
      text: "你在西市的门槛旁停下，先辨认货包上的封记，再向家人确认今日该接待哪一批商旅。这个决定没有改变你的身份，却让你开始把记忆和谨慎当作谋生的本钱。",
      choices: [
        { id: "ask-family", label: "继续询问家人", consequenceHint: "获得更完整的来客信息" },
        { id: "inspect-goods", label: "检查货包封记", consequenceHint: "尝试判断货物来源" },
        { id: "wait", label: "先在门旁观察", consequenceHint: "等待新的线索出现" },
      ],
      classification: "合理重建",
      sourceIds: ["S-004"],
      evidence: [
        { sourceId: "S-004", classification: "合理重建", claim: "西市作为长安商业活动的重要场所，为叙事行动提供空间背景。" },
      ],
    };
    const commitArguments = {
      p_session_id: saveId,
      p_client_turn_id: clientTurnId,
      p_expected_state_version: 0,
      p_input: turnInput,
      p_narrative: narrative,
      p_state_after: stateAfter,
      p_source_ids: ["S-004"],
      p_provider_response_id: "supabase-live-contract",
    };
    const { data: forbiddenCommit, error: forbiddenCommitError } = await userA.rpc("commit_game_turn", {
      ...commitArguments,
    });
    assert.ok(forbiddenCommitError, "a signed-in browser must not call the commit RPC directly");
    assert.equal(forbiddenCommit, null);

    let committed = null;
    if (serverClient) {
      const { data, error } = await serverClient.rpc("server_commit_game_turn", {
        p_owner_id: authA.user.id,
        ...commitArguments,
      });
      assert.ifError(error);
      committed = data;
      assert.equal(committed?.stateVersion, 1);
      assert.equal(committed?.worldState?.time?.turn, 1);
    }

    const { data: ownTurns, error: ownTurnsError } = await userA
      .from("game_turns")
      .select("id,client_turn_id,committed_state_version")
      .eq("session_id", saveId);
    assert.ifError(ownTurnsError);
    assert.equal(ownTurns?.length, serverClient ? 1 : 0);
    if (serverClient) assert.equal(ownTurns?.[0]?.client_turn_id, clientTurnId);

    for (const table of ["game_turns", "game_checkpoints", "game_turn_requests"]) {
      const { data: foreignRows, error: foreignRowsError } = await userB
        .from(table)
        .select("id")
        .eq(table === "game_turn_requests" ? "session_id" : "session_id", saveId);
      assert.ifError(foreignRowsError);
      assert.deepEqual(foreignRows, [], `user B must not read user A's ${table}`);
    }

    const { data: duplicateReservation, error: duplicateReservationError } = await userA.rpc("reserve_game_turn", {
      p_session_id: saveId,
      p_client_turn_id: clientTurnId,
      p_expected_state_version: 0,
      p_input: turnInput,
    });
    assert.ifError(duplicateReservationError);
    assert.equal(duplicateReservation?.status, serverClient ? "committed" : "in_progress");
    if (serverClient) assert.equal(duplicateReservation?.snapshot?.stateVersion, 1);

    const { error: foreignReservationError } = await userB.rpc("reserve_game_turn", {
      p_session_id: saveId,
      p_client_turn_id: crypto.randomUUID(),
      p_expected_state_version: serverClient ? 1 : 0,
      p_input: turnInput,
    });
    assert.ok(foreignReservationError, "user B must not reserve a turn in user A's session");

    const { data: foreignDelete, error: foreignDeleteError } = await userB.rpc("delete_game_session", {
      p_session_id: saveId,
    });
    assert.ifError(foreignDeleteError);
    assert.equal(foreignDelete, false, "user B must not delete user A's session");

    uploadPath = `${authA.user.id}/${crypto.randomUUID()}/rls-test.png`;
    const onePixelPng = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2,
    ]);
    const { error: uploadError } = await userA.storage
      .from("user-uploads")
      .upload(uploadPath, onePixelPng, { contentType: "image/png", upsert: false });
    assert.ifError(uploadError);

    const { data: ownDownload, error: ownDownloadError } = await userA.storage
      .from("user-uploads")
      .download(uploadPath);
    assert.ifError(ownDownloadError);
    assert.equal(ownDownload?.size, onePixelPng.byteLength);

    const { data: uploadRecord, error: uploadRecordError } = await userA
      .from("user_uploads")
      .insert({
        owner_id: authA.user.id,
        storage_path: uploadPath,
        original_name: "rls-test.png",
        mime_type: "image/png",
        size_bytes: onePixelPng.byteLength,
      })
      .select("id")
      .single();
    assert.ifError(uploadRecordError);
    assert.ok(uploadRecord?.id);
    uploadId = uploadRecord.id;

    const { error: foreignDownloadError } = await userB.storage
      .from("user-uploads")
      .download(uploadPath);
    assert.ok(foreignDownloadError, "user B must not download user A's private object");

    const { data: foreignMetadata, error: foreignMetadataError } = await userB
      .from("user_uploads")
      .select("id")
      .eq("id", uploadId);
    assert.ifError(foreignMetadataError);
    assert.deepEqual(foreignMetadata, []);

    const { data: foreignMetadataUpdate, error: foreignMetadataUpdateError } = await userB
      .from("user_uploads")
      .update({ status: "deleted" })
      .eq("id", uploadId)
      .select("id");
    assert.ifError(foreignMetadataUpdateError);
    assert.deepEqual(foreignMetadataUpdate, []);

    const { data: foreignMetadataDelete, error: foreignMetadataDeleteError } = await userB
      .from("user_uploads")
      .delete()
      .eq("id", uploadId)
      .select("id");
    assert.ifError(foreignMetadataDeleteError);
    assert.deepEqual(foreignMetadataDelete, []);

    const { error: foreignUploadError } = await userB.storage
      .from("user-uploads")
      .upload(`${authA.user.id}/${crypto.randomUUID()}/forbidden.png`, onePixelPng, {
        contentType: "image/png",
        upsert: false,
      });
    assert.ok(foreignUploadError, "user B must not upload into user A's folder");

    if (!upgradeEmail) return;

    const upgradePassword = `Ck-${crypto.randomUUID()}-9aA!`;
    const { data: upgrade, error: upgradeError } = await userA.auth.updateUser({
      email: upgradeEmail,
      password: upgradePassword,
      data: testMetadata,
    });
    assert.ifError(upgradeError);
    assert.equal(upgrade.user?.id, authA.user.id);
    assert.equal(typeof upgrade.user?.is_anonymous, "boolean");

    const { data: saveAfterUpgrade, error: saveAfterUpgradeError } = await userA
      .from("game_sessions")
      .select("id")
      .eq("id", saveId)
      .single();
    assert.ifError(saveAfterUpgradeError);
    assert.equal(saveAfterUpgrade?.id, saveId);

    if (upgrade.user?.is_anonymous === false) {
      await userA.auth.signOut();
      upgradedUser = createClient(url, publishableKey, options);
      const { data: permanentAuth, error: permanentAuthError } = await upgradedUser.auth.signInWithPassword({
        email: upgradeEmail,
        password: upgradePassword,
      });
      assert.ifError(permanentAuthError);
      assert.equal(permanentAuth.user?.id, authA.user.id, "upgrade must preserve the original auth user id");

      const { data: saveAfterSignIn, error: saveAfterSignInError } = await upgradedUser
        .from("game_sessions")
        .select("id")
        .eq("id", saveId)
        .single();
      assert.ifError(saveAfterSignInError);
      assert.equal(saveAfterSignIn?.id, saveId, "the upgraded account must retain the guest save");
    }
  } finally {
    if (uploadId) await upgradedUser.from("user_uploads").delete().eq("id", uploadId);
    if (uploadPath) await upgradedUser.storage.from("user-uploads").remove([uploadPath]);
    if (saveId) {
      const data = await deleteSessionWithTransientRetry(upgradedUser, saveId);
      assert.equal(data, true);
    }
    if (saveBId) {
      const data = await deleteSessionWithTransientRetry(userB, saveBId);
      assert.equal(data, true);
    }
    await Promise.all([upgradedUser.auth.signOut(), userB.auth.signOut()]);
  }
});

test("phase 6 admission control limits new turn reservations per owner", {
  skip: !url || !publishableKey ? "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are not configured" : false,
  timeout: 120_000,
}, async () => {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const runId = crypto.randomUUID();
  let sessionId;
  const { data: auth, error: authError } = await client.auth.signInAnonymously({
    options: { data: { chronokalamos_rate_limit_test: runId } },
  });
  assert.ifError(authError);
  assert.ok(auth.user);

  try {
    const { data: session, error: sessionError } = await client.rpc("create_or_get_game_session", {
      p_client_session_id: crypto.randomUUID(),
      p_origin_id: "merchant",
    });
    assert.ifError(sessionError);
    assert.ok(session?.id);
    sessionId = session.id;

    for (let index = 0; index < 12; index += 1) {
      const { data, error } = await client.rpc("reserve_game_turn", {
        p_session_id: sessionId,
        p_client_turn_id: crypto.randomUUID(),
        p_expected_state_version: 0,
        p_input: { action: { kind: "free_text", text: `第${index + 1}次受控测试` } },
      });
      assert.ifError(error);
      assert.equal(data?.status, "reserved");
    }

    const { data: blocked, error: blockedError } = await client.rpc("reserve_game_turn", {
      p_session_id: sessionId,
      p_client_turn_id: crypto.randomUUID(),
      p_expected_state_version: 0,
      p_input: { action: { kind: "free_text", text: "第13次应被限流" } },
    });
    assert.ok(blockedError);
    assert.equal(blocked, null);
    assert.match(blockedError.message, /turn_rate_limited/);
  } finally {
    if (sessionId) {
      const deleted = await deleteSessionWithTransientRetry(client, sessionId);
      assert.equal(deleted, true);
    }
    await client.auth.signOut();
  }
});
});
