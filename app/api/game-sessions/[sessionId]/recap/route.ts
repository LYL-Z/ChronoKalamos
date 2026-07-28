import { authenticateApiRequest, loadOwnedApiSession } from "@/lib/game/api-session";
import { createReplaySummary } from "@/lib/game/rules";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    const { client } = await authenticateApiRequest(request);
    const session = await loadOwnedApiSession(client, sessionId);
    return withSecurityHeaders(
      Response.json(createReplaySummary(session.id, session.world_state)),
      request,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "recap_failed";
    const status = code.startsWith("authentication_")
      ? 401
      : code === "session_not_found"
        ? 404
        : 400;
    return withSecurityHeaders(
      Response.json({ code, message: "无法读取该存档回顾。" }, { status }),
      request,
    );
  }
}
