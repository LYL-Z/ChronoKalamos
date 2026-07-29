const baseUrl = process.env.SUPABASE_URL ?? process.env.SUPABASE_TEST_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_TEST_SECRET_KEY;
if (!baseUrl || !secretKey) {
  throw new Error("supabase_error_budget_configuration_missing");
}

const windowDays = Number(process.env.ERROR_BUDGET_WINDOW_DAYS ?? "7");
const successSlo = Number(process.env.AI_SUCCESS_SLO_PERCENT ?? "97") / 100;
if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 30) {
  throw new Error("error_budget_window_invalid");
}
if (!(successSlo > 0.9 && successSlo < 1)) throw new Error("error_budget_slo_invalid");

const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
const endpoint = new URL("/rest/v1/ai_call_audit", baseUrl);
endpoint.searchParams.set("select", "result_code");
endpoint.searchParams.set("created_at", `gte.${since}`);
endpoint.searchParams.set("result_code", "neq.reserved");
const response = await fetch(endpoint, {
  headers: {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    Accept: "application/json",
  },
  cache: "no-store",
});
if (!response.ok) throw new Error(`error_budget_query_failed:${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows)) throw new Error("error_budget_response_invalid");

const failures = rows.filter((row) => row?.result_code !== "success").length;
const failureRate = rows.length === 0 ? 0 : failures / rows.length;
const allowedFailureRate = 1 - successSlo;
const consumed = allowedFailureRate === 0 ? 0 : failureRate / allowedFailureRate;
console.log(JSON.stringify({
  windowDays,
  sampleSize: rows.length,
  successSlo,
  observedSuccessRate: rows.length === 0 ? null : 1 - failureRate,
  errorBudgetConsumed: rows.length === 0 ? null : consumed,
}));

if (rows.length >= 20 && consumed > 1) process.exitCode = 1;
