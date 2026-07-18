import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const upgradeEmail = process.env.SUPABASE_TEST_UPGRADE_EMAIL;

test("two users are isolated and an optional controlled email can exercise guest upgrade", {
  skip: !url || !publishableKey ? "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are not configured" : false,
  timeout: 60_000,
}, async () => {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const userA = createClient(url, publishableKey, options);
  const userB = createClient(url, publishableKey, options);
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

    const { data: saveA, error: insertError } = await userA
      .from("game_sessions")
      .insert({
        owner_id: authA.user.id,
        client_session_id: clientSessionId,
        title: "RLS live test",
      })
      .select("id")
      .single();
    assert.ifError(insertError);
    assert.ok(saveA?.id);
    saveId = saveA.id;

    const { error: retryError } = await userA
      .from("game_sessions")
      .upsert({
        owner_id: authA.user.id,
        client_session_id: clientSessionId,
        title: "must not overwrite on retry",
      }, { onConflict: "owner_id,client_session_id", ignoreDuplicates: true });
    assert.ifError(retryError);

    const { data: retryResult, error: retryReadError } = await userA
      .from("game_sessions")
      .select("id,title")
      .eq("owner_id", authA.user.id)
      .eq("client_session_id", clientSessionId)
      .single();
    assert.ifError(retryReadError);
    assert.equal(retryResult?.id, saveId);
    assert.equal(retryResult?.title, "RLS live test");

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
    assert.ifError(updateError);
    assert.deepEqual(attemptedUpdate, []);

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
    if (saveId) await upgradedUser.from("game_sessions").delete().eq("id", saveId);
    await Promise.all([upgradedUser.auth.signOut(), userB.auth.signOut()]);
  }
});
