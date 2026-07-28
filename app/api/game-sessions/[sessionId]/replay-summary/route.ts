import { authenticateApiRequest, loadOwnedApiSession } from "@/lib/game/api-session";
import { createServerSupabaseClient } from "@/lib/game/supabase-repository";
import { createReplaySummary } from "@/lib/game/rules";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    const { client, user } = await authenticateApiRequest(request);
    const session = await loadOwnedApiSession(client, sessionId);
    if (!session.world_state.story.chapterEnding) {
      return withSecurityHeaders(
        Response.json(
          {
            code: "chapter_not_ended",
            message: "章节尚未结束，不能固化重玩摘要。",
          },
          { status: 409 },
        ),
        request,
      );
    }

    const summary = createReplaySummary(session.id, session.world_state);
    const serverClient = createServerSupabaseClient();
    const { error } = await serverClient.from("game_replay_summaries").upsert(
      {
        session_id: session.id,
        owner_id: user.id,
        chapter_id: summary.chapterId,
        content_version: "10.0.0",
        state_version: session.state_version,
        summary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,owner_id,chapter_id" },
    );
    if (error) throw new Error("replay_summary_commit_failed");
    return withSecurityHeaders(Response.json(summary), request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "replay_summary_failed";
    const status = code.startsWith("authentication_")
      ? 401
      : code === "session_not_found"
        ? 404
        : 400;
    return withSecurityHeaders(
      Response.json({ code, message: "无法生成重玩摘要。" }, { status }),
      request,
    );
  }
}
