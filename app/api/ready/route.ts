import { checkReadiness } from "@/lib/health/readiness";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const readiness = await checkReadiness();
  return withSecurityHeaders(Response.json({
    ...readiness,
    service: "chronokalamos",
    scenario: "tang-changan-742",
    release: process.env.APP_RELEASE?.slice(0, 64) || "unknown",
  }, {
    status: readiness.status === "ready" ? 200 : 503,
  }), request);
}
