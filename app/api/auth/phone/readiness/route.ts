import { getPhoneAuthReadiness } from "@/lib/auth/phone/config";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const readiness = getPhoneAuthReadiness();
  return withSecurityHeaders(Response.json({
    ...readiness,
    message: readiness.enabled
      ? "Phone authentication is enabled by an explicitly verified server configuration."
      : "Phone authentication is a preparation track and does not send SMS.",
  }), request);
}
