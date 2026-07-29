const baseUrl = (process.env.PRODUCTION_BASE_URL ?? "https://chronokalamos.com")
  .replace(/\/+$/, "");
const timeoutMs = 10_000;

async function check(path, expectedStatus, expectedBodyStatus) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.json();
    if (response.status !== expectedStatus || body.status !== expectedBodyStatus) {
      throw new Error(`${path}:unexpected_health_response`);
    }
    return {
      path,
      status: response.status,
      release: typeof body.release === "string" ? body.release : "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const checks = [await check("/api/health", 200, "ok")];
if (process.env.CHECK_READINESS === "true") {
  checks.push(await check("/api/ready", 200, "ready"));
}
console.log(JSON.stringify({ baseUrl, checks }));
