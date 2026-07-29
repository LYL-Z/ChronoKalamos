import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error("SUPABASE_TEST_URL/SUPABASE_URL and SUPABASE_TEST_SECRET_KEY/SUPABASE_SECRET_KEY are required");
}

const apply = process.argv.includes("--apply");
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data, error } = await client
  .from("playtest_enrollments")
  .select("id")
  .eq("app_release", "36")
  .lt("consented_at", cutoff)
  .limit(1000);
if (error) throw error;
const ids = data.map((row) => row.id);

if (apply && ids.length) {
  const { error: deleteError } = await client
    .from("playtest_enrollments")
    .delete()
    .in("id", ids);
  if (deleteError) throw deleteError;
}

console.log(JSON.stringify({
  mode: apply ? "applied" : "dry-run",
  cutoff,
  enrollmentsMatched: ids.length,
  associatedEvents: "cascade-delete",
}, null, 2));

