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

  const { data: invisibleToB, error: readError } = await userB
    .from("game_sessions")
    .select("id")
    .eq("id", saveA.id);
  assert.ifError(readError);
  assert.deepEqual(invisibleToB, []);

  const { data: attemptedUpdate, error: updateError } = await userB
    .from("game_sessions")
    .update({ title: "cross-user overwrite" })
    .eq("id", saveA.id)
    .select("id");
  assert.ifError(updateError);
  assert.deepEqual(attemptedUpdate, []);

  const uploadPath = `${authA.user.id}/${crypto.randomUUID()}/rls-test.png`;
  const onePixelPng = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
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

  await userA.storage.from("user-uploads").remove([uploadPath]);
  await userA.from("game_sessions").delete().eq("id", saveA.id);
  await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
});

