import { AIProviderError, type AIProvider } from "@/lib/game/ai-provider";
import {
  assessActionBoundary,
  normalizeWorldState,
  resolveEventAction,
  validateNarrativeExpression,
} from "@/lib/game/rules";
import {
  type CommittedTurn,
  type TurnRequest,
  type TurnStreamEvent,
} from "@/lib/game/schemas";
import type { GameTurnRepository } from "@/lib/game/supabase-repository";

type Emit = (event: TurnStreamEvent) => void | Promise<void>;

class TurnFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TurnFailure";
  }
}

function narrativeChunks(text: string): string[] {
  const chunks = text
    .split(/(?<=[。！？；])/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length > 0) return chunks;
  return [text];
}

async function replayCommitted(turn: CommittedTurn, emit: Emit): Promise<void> {
  let sequence = 0;
  for (const delta of narrativeChunks(turn.narrative.narrative.text)) {
    await emit({ event: "narrative.delta", data: { delta, sequence } });
    sequence += 1;
  }
  await emit({
    event: "choices.ready",
    data: {
      choices: turn.narrative.choices,
      sourceIds: turn.narrative.sourceIds,
      classification: turn.narrative.narrative.classification,
    },
  });
  await emit({
    event: "state.committed",
    data: { ...turn, duplicate: true },
  });
}

function classifyUnexpected(error: unknown): TurnFailure {
  if (error instanceof TurnFailure) return error;
  if (error instanceof AIProviderError) {
    return new TurnFailure(
      error.code,
      error.message,
      error.code === "model_timeout" || error.code === "model_failed",
    );
  }
  const raw = error instanceof Error ? error.message : "unknown_error";
  if (raw.includes("state_version_conflict")) {
    return new TurnFailure("state_version_conflict", "存档版本已变化，请刷新后重试。本回合未提交。", true);
  }
  if (raw.includes("turn_in_progress")) {
    return new TurnFailure("turn_in_progress", "相同回合正在处理中，没有发起第二次模型调用。", true);
  }
  if (raw.includes("turn_rate_limited")) {
    return new TurnFailure("rate_limited", "操作过于频繁，请稍后重试。本回合未提交。", true);
  }
  return new TurnFailure("turn_failed", "回合处理失败，数据库状态未改变。", true);
}

export async function runTurnWorkflow(options: {
  sessionId: string;
  request: TurnRequest;
  repository: GameTurnRepository;
  provider: AIProvider;
  emit: Emit;
}): Promise<void> {
  const { sessionId, request, repository, provider, emit } = options;
  let reserved = false;

  try {
    const reservation = await repository.reserveTurn(sessionId, request);
    if (reservation.status === "committed") {
      await emit({
        event: "turn.started",
        data: {
          clientTurnId: request.clientTurnId,
          stateVersion: request.expectedStateVersion,
          duplicate: true,
        },
      });
      await replayCommitted(reservation.snapshot, emit);
      return;
    }
    if (reservation.status === "failed") {
      await emit({
        event: "turn.failed",
        data: {
          code: reservation.failureCode,
          message: reservation.failureMessage,
          retryable: false,
          notCommitted: true,
        },
      });
      return;
    }
    if (reservation.status === "in_progress") {
      throw new TurnFailure("turn_in_progress", "相同回合正在处理中，没有发起第二次模型调用。", true);
    }
    reserved = true;

    await emit({
      event: "turn.started",
      data: {
        clientTurnId: request.clientTurnId,
        stateVersion: request.expectedStateVersion,
        duplicate: false,
      },
    });

    const session = await repository.loadSession(sessionId);
    if (session.state_version !== request.expectedStateVersion) {
      throw new TurnFailure("state_version_conflict", "存档版本已变化，请刷新后重试。本回合未提交。", true);
    }
    const state = normalizeWorldState(session.world_state, session.character_profile.origin);
    const boundary = assessActionBoundary(request.action, state);
    if (!boundary.allowed) {
      throw new TurnFailure(boundary.code, `${boundary.explanation} 本回合未提交。`, false);
    }

    const catalog = await repository.loadNarrativeCatalog(session);
    if (catalog.manifest.scenarioId !== session.scenario_id) {
      throw new TurnFailure("scenario_manifest_mismatch", "场景版本与存档不一致，本回合未提交。", false);
    }
    const resolution = resolveEventAction(state, request.action, catalog.events);
    const evidence = await repository.retrieveEvidence(session, resolution.event);
    const imageUrl = request.action.kind === "image"
      ? await repository.createSignedUploadUrl(request.action.uploadId)
      : undefined;
    const moderation = await provider.moderate({
      text: request.action.text,
      imageUrl,
    });
    if (moderation.flagged) {
      throw new TurnFailure(
        "content_blocked",
        `输入未通过内容审核（${moderation.categories.join("、") || "未公开类别"}）。本回合未提交。`,
        false,
      );
    }

    let lastValidationError = "";
    for (const attempt of [1, 2] as const) {
      try {
        const generated = await provider.generate({
          userId: repository.userId,
          action: request.action,
          worldState: state,
          boundary,
          claims: evidence.claims,
          sources: evidence.sources,
          event: resolution.event,
          selectedChoice: resolution.choice,
          nextEvent: resolution.nextEvent,
          interpretedFreeText: resolution.interpretedFreeText,
          imageUrl,
          attempt,
          retryFeedback: attempt === 2 ? lastValidationError : undefined,
        });
        const validated = validateNarrativeExpression(
          generated.output,
          state,
          evidence.claims,
          resolution,
        );

        let sequence = 0;
        for (const delta of narrativeChunks(validated.generation.narrative.text)) {
          await emit({ event: "narrative.delta", data: { delta, sequence } });
          sequence += 1;
        }
        await emit({
          event: "choices.ready",
          data: {
            choices: validated.generation.choices,
            sourceIds: validated.generation.sourceIds,
            classification: validated.generation.narrative.classification,
          },
        });

        const committed = await repository.commitTurn(
          sessionId,
          request,
          validated.generation,
          validated.nextState,
          generated.responseId,
        );
        await emit({ event: "state.committed", data: committed });
        return;
      } catch (error) {
        const isProviderError = error instanceof AIProviderError;
        const shouldRetry =
          attempt === 1
          && (!isProviderError || error.code === "model_failed");
        if (!shouldRetry) throw error;
        lastValidationError = error instanceof Error ? error.message.slice(0, 240) : "invalid_generation";
      }
    }

    throw new TurnFailure("validation_failed", "模型输出两次未通过规则校验，本回合未提交。", true);
  } catch (error) {
    const failure = classifyUnexpected(error);
    if (reserved && failure.code !== "turn_in_progress") {
      await repository.failTurn(sessionId, request.clientTurnId, failure.code, failure.message).catch(() => undefined);
    }
    await emit({
      event: "turn.failed",
      data: {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
        notCommitted: true,
      },
    });
  }
}
