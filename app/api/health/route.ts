import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return withSecurityHeaders(Response.json({
    status: "ok",
    service: "chronokalamos",
    scenario: "tang-changan-742",
  }), request);
}
