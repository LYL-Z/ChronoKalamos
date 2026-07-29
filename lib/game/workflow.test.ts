import { describe, expect, it } from "vitest";
import type { AIProvider, GenerationContext, ModerationInput, ModerationResult, ProviderGeneration } from "./ai-provider";
import { phase10EventTemplates, phase10ScenarioManifest } from "./event-catalog";
import { createInitialWorldState } from "./rules";
import type { GameSessionRecord, GameTurnRepository, HistoricalEvidence, ReserveResult } from "./supabase-repository";
import type { CommittedTurn, NarrativeExpression, TurnGeneration, TurnRequest } from "./schemas";
import { runTurnWorkflow } from "./workflow";
import type { AiBudgetLimits, AiCallReservation, AiCallResultCode } from "./ai-budget";

const sessionId = "018f2614-326b-7e67-b42d-0f19cde35dc1";
const clientTurnId = "018f2614-326b-7e67-b42d-0f19cde35dc2";

function expression(sourceId = "S-004"): NarrativeExpression {
  return {
    title: "验证中的场景",
    text: "你把账纸放回案边。它没有自动揭示一段完整历史，只让今天的行动获得了一个可核验的方向。你仍需要在有限的时间、地点和关系中决定下一步，也不能把模型的连接性文字误认成档案中的直接记录。",
    choiceVariants: [
      { id: "choice-1", label: "请家庭管事共同复核", intent: "用关系信用降低误判风险" },
      { id: "choice-2", label: "接受一笔小额损失换取延期", intent: "用有限金钱降低期限压力" },
      { id: "choice-3", label: "独自承担并立即交割", intent: "以个人判断换取速度" },
    ],
    sourceIds: [sourceId],
  };
}

class FakeProvider implements AIProvider {
  readonly name = "deepseek-chat" as const;
  generateCalls = 0;
  constructor(private readonly invalidFirst = false) {}
  async moderate(input: ModerationInput): Promise<ModerationResult> {
    void input;
    return { flagged: false, categories: [] };
  }
  async generate(context: GenerationContext): Promise<ProviderGeneration> {
    void context;
    this.generateCalls += 1;
    return {
      responseId: `resp-${this.generateCalls}`,
      output: expression(this.invalidFirst && this.generateCalls === 1 ? "S-999" : "S-004"),
    };
  }
}

class FakeRepository implements GameTurnRepository {
  readonly userId = "018f2614-326b-7e67-b42d-0f19cde35dc3";
  private committed: CommittedTurn | null = null;
  failCount = 0;
  commitCount = 0;
  aiReservations: Array<{ attempt: 1 | 2; limits: AiBudgetLimits }> = [];
  aiCompletions: Array<{ attempt: 1 | 2; resultCode: AiCallResultCode }> = [];
  aiReservationResult: AiCallReservation = {
    status: "reserved",
    userDailyCount: 1,
    globalDailyCount: 1,
  };
  private readonly session: GameSessionRecord = {
    id: sessionId,
    owner_id: this.userId,
    scenario_id: "tang-changan-742",
    content_version: "10.0.0",
    character_profile: { origin: "merchant" },
    world_state: {
      ...createInitialWorldState("merchant"),
      story: {
        ...createInitialWorldState("merchant").story,
        chapterId: "merchant-first-ledger",
      },
    },
    status: "draft",
    state_version: 0,
  };

  async loadSession(): Promise<GameSessionRecord> {
    return this.session;
  }
  async reserveTurn(sessionIdArg: string, requestArg: TurnRequest): Promise<ReserveResult> {
    void sessionIdArg;
    void requestArg;
    if (this.committed) {
      return { status: "committed", inputHash: "a".repeat(64), snapshot: this.committed };
    }
    return { status: "reserved", inputHash: "a".repeat(64), leaseExpiresAt: new Date().toISOString() };
  }
  async retrieveEvidence(sessionArg: GameSessionRecord): Promise<HistoricalEvidence> {
    void sessionArg;
    return {
      claims: [{ id: "C-O-001", classification: "合理重建", text: "商业背景", sourceIds: ["S-004"] }],
      sources: [{ id: "S-004", title: "source", creator: "author", locator: "locator", licenseCode: "citation-only" }],
    };
  }
  async loadNarrativeCatalog() {
    return { manifest: phase10ScenarioManifest, events: phase10EventTemplates };
  }
  async createSignedUploadUrl(): Promise<string> {
    return "https://example.invalid/signed-image";
  }
  async reserveAiCall(
    clientTurnIdArg: string,
    attempt: 1 | 2,
    limits: AiBudgetLimits,
  ): Promise<AiCallReservation> {
    void clientTurnIdArg;
    this.aiReservations.push({ attempt, limits });
    if (this.aiReservationResult.status !== "reserved") return this.aiReservationResult;
    return {
      ...this.aiReservationResult,
      userDailyCount: this.aiReservations.length,
      globalDailyCount: this.aiReservations.length,
    };
  }
  async completeAiCall(
    clientTurnIdArg: string,
    attempt: 1 | 2,
    resultCode: AiCallResultCode,
  ): Promise<void> {
    void clientTurnIdArg;
    this.aiCompletions.push({ attempt, resultCode });
  }
  async commitTurn(sessionIdArg: string, requestArg: TurnRequest, narrative: TurnGeneration, nextState: ReturnType<typeof createInitialWorldState>, providerResponseId: string): Promise<CommittedTurn> {
    void sessionIdArg;
    void requestArg;
    void providerResponseId;
    this.commitCount += 1;
    this.committed = {
      turnId: "018f2614-326b-7e67-b42d-0f19cde35dc4",
      stateVersion: 1,
      worldState: nextState,
      narrative,
      duplicate: false,
    };
    return this.committed;
  }
  async failTurn(): Promise<void> {
    this.failCount += 1;
  }
}

const request: TurnRequest = {
  clientTurnId,
  expectedStateVersion: 0,
  action: { kind: "free_text", text: "观察今日的案边物件" },
};

describe("phase 5 workflow", () => {
  it("does not call the provider twice for a duplicate clientTurnId", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const events: string[] = [];

    await runTurnWorkflow({ sessionId, request, repository, provider, emit: (event) => { events.push(event.event); if (event.event === "turn.failed") console.log("failure", event.data); } });
    await runTurnWorkflow({ sessionId, request, repository, provider, emit: (event) => { events.push(event.event); if (event.event === "turn.failed") console.log("failure", event.data); } });

    expect(provider.generateCalls).toBe(1);
    expect(repository.commitCount).toBe(1);
    expect(repository.failCount).toBe(0);
    expect(repository.aiReservations).toHaveLength(1);
    expect(repository.aiCompletions).toEqual([{ attempt: 1, resultCode: "success" }]);
    expect(events.filter((event) => event === "state.committed")).toHaveLength(2);
  });

  it("retries one invalid candidate, then commits only the valid candidate", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider(true);
    const events: string[] = [];

    await runTurnWorkflow({ sessionId, request, repository, provider, emit: (event) => { events.push(event.event); if (event.event === "turn.failed") console.log("failure", event.data); } });

    expect(provider.generateCalls).toBe(2);
    expect(repository.commitCount).toBe(1);
    expect(repository.failCount).toBe(0);
    expect(repository.aiReservations.map((entry) => entry.attempt)).toEqual([1, 2]);
    expect(repository.aiCompletions).toEqual([
      { attempt: 1, resultCode: "validation_failed" },
      { attempt: 2, resultCode: "success" },
    ]);
    expect(events.at(-1)).toBe("state.committed");
  });

  it("fails closed before provider generation when the user daily budget is exhausted", async () => {
    const repository = new FakeRepository();
    repository.aiReservationResult = {
      status: "user_daily_limit",
      userDailyCount: 40,
      globalDailyCount: 41,
    };
    const provider = new FakeProvider();
    const failures: Array<{ code: string; notCommitted: boolean }> = [];

    await runTurnWorkflow({
      sessionId,
      request,
      repository,
      provider,
      emit: (event) => {
        if (event.event === "turn.failed") failures.push(event.data);
      },
    });

    expect(provider.generateCalls).toBe(0);
    expect(repository.aiCompletions).toHaveLength(0);
    expect(repository.commitCount).toBe(0);
    expect(repository.failCount).toBe(1);
    expect(failures.at(-1)).toMatchObject({
      code: "ai_daily_user_limit",
      notCommitted: true,
    });
  });
});
