import { phase10EventTemplates } from "@/lib/game/event-catalog";
import { authenticateApiRequest, loadOwnedApiSession } from "@/lib/game/api-session";
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
    const story = session.world_state.story;
    const events = phase10EventTemplates
      .filter(
        (event) =>
          event.chapterId === story.chapterId
          && event.originIds.includes(session.world_state.socialIdentity),
      )
      .map((event) => ({
        eventId: event.eventId,
        title: event.title,
        classification: event.classification,
        status: story.completedEventIds.includes(event.eventId)
          ? "completed"
          : story.currentEventId === event.eventId
            ? "current"
            : "locked",
      }));
    return withSecurityHeaders(
      Response.json({
        sessionId: session.id,
        chapterId: story.chapterId,
        currentEventId: story.currentEventId,
        ending: story.chapterEnding,
        events,
      }),
      request,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "chapters_failed";
    const status = code.startsWith("authentication_")
      ? 401
      : code === "session_not_found"
        ? 404
        : 400;
    return withSecurityHeaders(
      Response.json({ code, message: "无法读取章节状态。" }, { status }),
      request,
    );
  }
}
