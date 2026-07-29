import { createAIProviderFromEnvironment, AIProviderError } from "@/lib/game/ai-provider";
import { turnRequestSchema, type TurnStreamEvent } from "@/lib/game/schemas";
import {
  createAuthenticatedSupabaseClient,
  createServerSupabaseClient,
  SupabaseGameRepository,
} from "@/lib/game/supabase-repository";
import { runTurnWorkflow } from "@/lib/game/workflow";
import { withSecurityHeaders } from "@/lib/security/http";
import { writeSecurityAudit } from "@/lib/security/audit";
import { aiTurnsEnabled } from "@/lib/game/ai-budget";
import { z } from "zod";

export const dynamic = "force-dynamic";
const MAX_TURN_REQUEST_BYTES = 24 * 1024;
const sessionIdSchema = z.string().uuid();

function eventFrame(event: TurnStreamEvent): Uint8Array {
  return new TextEncoder().encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

function failedEvent(code: string, message: string, retryable: boolean): TurnStreamEvent {
  return {
    event: "turn.failed",
    data: { code, message, retryable, notCommitted: true },
  };
}

function streamResponse(
  run: (emit: (event: TurnStreamEvent) => void) => Promise<void>,
  request: Request,
  status = 200,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: TurnStreamEvent) => {
        if (open) controller.enqueue(eventFrame(event));
      };
      try {
        await run(emit);
      } catch {
        emit(failedEvent("stream_failed", "流式回合失败，数据库状态未改变。", true));
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return withSecurityHeaders(new Response(stream, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  }), request);
}

async function readBoundedBody(request: Request): Promise<{ ok: true; text: string } | { ok: false }> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TURN_REQUEST_BYTES) return { ok: false };

  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TURN_REQUEST_BYTES) {
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

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const params = await context.params;
  const boundedBody = await readBoundedBody(request);
  if (!boundedBody.ok) {
    await writeSecurityAudit({
      event: "turn.request_rejected",
      outcome: "denied",
      requestId,
      code: "request_too_large",
    });
    return streamResponse(async (emit) => {
      emit(failedEvent("request_too_large", "回合请求超过安全大小限制，本回合未提交。", false));
    }, request, 413);
  }

  let rawBody: unknown = null;
  try {
    rawBody = JSON.parse(boundedBody.text || "null") as unknown;
  } catch {
    rawBody = null;
  }
  const parsed = turnRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    await writeSecurityAudit({
      event: "turn.request_rejected",
      outcome: "denied",
      requestId,
      code: "invalid_request",
    });
    return streamResponse(async (emit) => {
      emit(failedEvent("invalid_request", "回合请求格式无效，状态未提交。", false));
    }, request);
  }

  const sessionId = sessionIdSchema.safeParse(params.sessionId);
  if (!sessionId.success) {
    await writeSecurityAudit({
      event: "turn.request_rejected",
      outcome: "denied",
      requestId,
      code: "invalid_session",
    });
    return streamResponse(async (emit) => {
      emit(failedEvent("invalid_session", "存档标识无效，本回合未提交。", false));
    }, request, 400);
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken || accessToken.length > 8192) {
    await writeSecurityAudit({
      event: "turn.authentication_failed",
      outcome: "denied",
      requestId,
      code: "authentication_required",
    });
    return streamResponse(async (emit) => {
      emit(failedEvent("authentication_required", "请先创建游客身份或登录邮箱账户。", false));
    }, request, 401);
  }

  return streamResponse(async (emit) => {
    const client = createAuthenticatedSupabaseClient(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      await writeSecurityAudit({
        event: "turn.authentication_failed",
        outcome: "denied",
        requestId,
        code: "authentication_invalid",
      });
      emit(failedEvent("authentication_invalid", "登录凭证无效，请重新登录。", false));
      return;
    }

    if (!aiTurnsEnabled()) {
      emit(failedEvent(
        "ai_temporarily_disabled",
        "叙事服务正在维护，本回合未提交。请稍后重试。",
        true,
      ));
      await writeSecurityAudit({
        event: "turn.configuration_failed",
        outcome: "denied",
        requestId,
        actorId: data.user.id,
        code: "ai_temporarily_disabled",
      });
      return;
    }

    let provider;
    let serverClient;
    try {
      provider = createAIProviderFromEnvironment();
      serverClient = createServerSupabaseClient();
    } catch (error) {
      const message = error instanceof AIProviderError
        ? error.message
        : error instanceof Error && error.message === "supabase_server_secret_not_configured"
          ? "Supabase 服务端密钥未配置，本回合未提交。"
          : "AI 或事务服务未配置，本回合未提交。";
      emit(failedEvent(
        error instanceof AIProviderError ? "ai_not_configured" : "transaction_server_not_configured",
        message,
        false,
      ));
      await writeSecurityAudit({
        event: "turn.configuration_failed",
        outcome: "failed",
        requestId,
        actorId: data.user.id,
        code: error instanceof AIProviderError ? "ai_not_configured" : "transaction_server_not_configured",
      });
      return;
    }

    const auditedEmit = async (event: TurnStreamEvent) => {
      emit(event);
      if (event.event === "turn.started") {
        await writeSecurityAudit({
          event: "turn.started",
          outcome: "allowed",
          requestId,
          actorId: data.user.id,
        });
      } else if (event.event === "turn.failed") {
        await writeSecurityAudit({
          event: "turn.failed",
          outcome: "failed",
          requestId,
          actorId: data.user.id,
          code: event.data.code,
        });
      } else if (event.event === "state.committed") {
        await writeSecurityAudit({
          event: "turn.committed",
          outcome: "succeeded",
          requestId,
          actorId: data.user.id,
        });
      }
    };

    await runTurnWorkflow({
      sessionId: sessionId.data,
      request: parsed.data,
      repository: new SupabaseGameRepository(client, serverClient, data.user.id),
      provider,
      emit: auditedEmit,
    });
  }, request);
}
