import { createAIProviderFromEnvironment, AIProviderError } from "@/lib/game/ai-provider";
import { turnRequestSchema, type TurnStreamEvent } from "@/lib/game/schemas";
import {
  createAuthenticatedSupabaseClient,
  createServerSupabaseClient,
  SupabaseGameRepository,
} from "@/lib/game/supabase-repository";
import { runTurnWorkflow } from "@/lib/game/workflow";

export const dynamic = "force-dynamic";

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

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
): Promise<Response> {
  const params = await context.params;
  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = turnRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return streamResponse(async (emit) => {
      emit(failedEvent("invalid_request", "回合请求格式无效，状态未提交。", false));
    });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return streamResponse(async (emit) => {
      emit(failedEvent("authentication_required", "请先创建游客身份或登录邮箱账户。", false));
    });
  }

  return streamResponse(async (emit) => {
    const client = createAuthenticatedSupabaseClient(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      emit(failedEvent("authentication_invalid", "登录凭证无效，请重新登录。", false));
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
      return;
    }

    await runTurnWorkflow({
      sessionId: params.sessionId,
      request: parsed.data,
      repository: new SupabaseGameRepository(client, serverClient, data.user.id),
      provider,
      emit,
    });
  });
}
