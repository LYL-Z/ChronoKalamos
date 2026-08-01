import { z } from "zod";
import { authoritativeSystemActionRequestSchema } from "@/lib/game/schemas";
import { applyAuthoritativeSystemAction } from "@/lib/game/phase18-authority";
import {
  createAuthenticatedSupabaseClient,
  createServerSupabaseClient,
  SupabaseGameRepository,
} from "@/lib/game/supabase-repository";
import { normalizeWorldState } from "@/lib/game/rules";
import { writeSecurityAudit } from "@/lib/security/audit";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";
const sessionIdSchema = z.string().uuid();
const MAX_REQUEST_BYTES = 12 * 1024;

async function readBoundedBody(request: Request): Promise<{ ok: true; text: string } | { ok: false }> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return { ok: false };

  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(body) };
}

function response(request: Request, body: unknown, status: number): Response {
  return withSecurityHeaders(Response.json(body, { status }), request);
}

function errorMessage(error: unknown): { code: string; message: string; status: number } {
  const raw = error instanceof Error ? error.message : "system_action_failed";
  if (raw.includes("state_version_conflict")) return { code: "state_version_conflict", message: "存档版本已变化，请刷新后重试。行动未提交。", status: 409 };
  if (raw.includes("session_not_owned") || raw.includes("session_load_failed")) return { code: "session_not_owned", message: "没有访问该存档的权限。", status: 403 };
  if (raw.includes("energy_depleted")) return { code: "energy_depleted", message: "本日行动点已用尽。请先推进到下一日。", status: 422 };
  if (raw.includes("mutual_adult_consent_required") || raw.includes("actor_adulthood_unconfirmed")) return { code: "adult_consent_required", message: "婚姻事务要求双方成年、明确同意，并先确认玩家角色年龄。", status: 422 };
  if (raw.includes("ending_not_reachable")) return { code: "ending_not_reachable", message: raw.split("ending_not_reachable:")[1] ?? "结局条件尚未满足。", status: 422 };
  if (/required|invalid|unknown|missing|already|capacity|full|funds|owned|exists|ended/.test(raw)) {
    return { code: raw.split(":").at(-1)?.slice(0, 80) || "system_rule_rejected", message: "当前状态不满足该行动条件。行动未提交。", status: 422 };
  }
  return { code: "system_action_failed", message: "权威玩法事务失败，数据库状态未改变。", status: 500 };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const params = await context.params;
  const sessionId = sessionIdSchema.safeParse(params.sessionId);
  if (!sessionId.success) return response(request, { code: "invalid_session", message: "存档标识无效。" }, 400);

  const boundedBody = await readBoundedBody(request);
  if (!boundedBody.ok) {
    return response(request, { code: "request_too_large", message: "系统行动请求超过大小限制。" }, 413);
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken || accessToken.length > 8192) {
    return response(request, { code: "authentication_required", message: "请先创建游客身份或登录邮箱账户。" }, 401);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(boundedBody.text);
  } catch {
    raw = null;
  }
  const parsed = authoritativeSystemActionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    await writeSecurityAudit({ event: "system_action.rejected", outcome: "denied", requestId, code: "invalid_request" });
    return response(request, { code: "invalid_request", message: "系统行动格式无效。行动未提交。" }, 400);
  }

  const client = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return response(request, { code: "authentication_invalid", message: "登录凭证无效。" }, 401);

  try {
    const serverClient = createServerSupabaseClient();
    const repository = new SupabaseGameRepository(client, serverClient, data.user.id);
    const replay = await repository.findSystemActionReplay(sessionId.data, parsed.data);
    if (replay) {
      await writeSecurityAudit({
        event: "system_action.committed",
        outcome: "allowed",
        requestId,
        actorId: data.user.id,
        code: `${parsed.data.actionId}:duplicate`,
      });
      return response(request, replay, 200);
    }
    const session = await repository.loadSession(sessionId.data);
    if (session.state_version !== parsed.data.expectedStateVersion) throw new Error("state_version_conflict");
    const state = normalizeWorldState(session.world_state, session.character_profile.origin);
    const resolved = applyAuthoritativeSystemAction(state, parsed.data);
    const committed = await repository.commitSystemAction(
      sessionId.data,
      parsed.data,
      resolved.event,
      resolved.nextState,
    );
    await writeSecurityAudit({
      event: "system_action.committed",
      outcome: "allowed",
      requestId,
      actorId: data.user.id,
      code: parsed.data.actionId,
    });
    return response(request, committed, 200);
  } catch (error) {
    const mapped = errorMessage(error);
    await writeSecurityAudit({
      event: "system_action.failed",
      outcome: "failed",
      requestId,
      actorId: data.user.id,
      code: mapped.code,
    });
    return response(request, {
      ...mapped,
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { detail: (error instanceof Error ? error.message : "system_action_failed").slice(0, 240) }),
    }, mapped.status);
  }
}
