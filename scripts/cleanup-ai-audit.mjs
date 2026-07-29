const baseUrl = process.env.SUPABASE_URL ?? process.env.SUPABASE_TEST_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_TEST_SECRET_KEY;
if (!baseUrl || !secretKey) throw new Error("supabase_cleanup_configuration_missing");

const retentionDays = Number(process.env.AI_AUDIT_RETENTION_DAYS ?? "30");
if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 365) {
  throw new Error("ai_audit_retention_invalid");
}
const before = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
const endpoint = new URL("/rest/v1/rpc/cleanup_ai_call_audit", baseUrl);
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_before: before }),
});
if (!response.ok) throw new Error(`ai_audit_cleanup_failed:${response.status}`);
const deleted = await response.json();
console.log(JSON.stringify({ retentionDays, deletedRows: deleted }));
