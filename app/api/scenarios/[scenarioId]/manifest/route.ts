import { phase10ScenarioManifest } from "@/lib/game/event-catalog";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ scenarioId: string }> | { scenarioId: string } },
): Promise<Response> {
  const { scenarioId } = await context.params;
  const status = scenarioId === phase10ScenarioManifest.scenarioId ? 200 : 404;
  const body =
    status === 200
      ? phase10ScenarioManifest
      : { code: "scenario_not_found", message: "场景不存在或尚未发布。" };
  return withSecurityHeaders(Response.json(body, { status }), request);
}
