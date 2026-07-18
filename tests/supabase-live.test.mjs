import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;

test("two anonymous users cannot read each other's saves or private uploads", {
  skip: !url || !publishableKey ? "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY are not configured" : false,
  timeout: 30_000,
}, async () => {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const userA = createClient(url, publishableKey, options);
  const userB = createClient(url, publishableKey, options);
  const { data: authA, error: authAError } = await userA.auth.signInAnonymously();
  const { data: authB, error: authBError } = await userB.auth.signInAnonymously();
  assert.ifError(authAError);
  assert.ifError(authBError);
  assert.ok(authA.user);
  assert.ok(authB.user);

  const clientSessionId = crypto.randomUUID();
  let saveId;
  let uploadPath;

  try {
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
      }, { onConflict: "owner_id,client_session_id", ignoreDuplicates: true })
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

    const { error: foreignDownloadError } = await userB.storage
      .from("user-uploads")
      .download(uploadPath);
    assert.ok(foreignDownloadError, "user B must not download user A's private object");
  } finally {
    if (uploadPath) await userA.storage.from("user-uploads").remove([uploadPath]);
    if (saveId) await userA.from("game_sessions").delete().eq("id", saveId);
    await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
  }
});
