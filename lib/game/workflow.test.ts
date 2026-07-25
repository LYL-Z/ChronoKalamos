import { describe, expect, it } from "vitest";
import type { AIProvider, GenerationContext, ModerationInput, ModerationResult, ProviderGeneration } from "./ai-provider";
import { createInitialWorldState } from "./rules";
import type { GameSessionRecord, GameTurnRepository, HistoricalEvidence, ReserveResult } from "./supabase-repository";
import type { CommittedTurn, TurnGeneration, TurnRequest } from "./schemas";
import { runTurnWorkflow } from "./workflow";

const sessionId = "018f2614-326b-7e67-b42d-0f19cde35dc1";
const clientTurnId = "018f2614-326b-7e67-b42d-0f19cde35dc2";

function generation(sourceId = "S-004"): TurnGeneration {
  return {
    narrative: {
      title: "验证中的场景",
      text: "你把一件普通物品放回原处。它没有自动揭示一段完整历史，只让今天的行动获得了一个可核验的方向。你仍需要在有限的时间、地点和关系中决定下一步，也不能把模型的连接性文字误认成档案中的直接记录。",
      classification: "合理重建",
    },
    choices: [
      { id: "choice-1", label: "观察一眼", intent: "收集线索", risk: "low" },
      { id: "choice-2", label: "询问一人", intent: "联系他人", risk: "medium" },
      { id: "choice-3", label: "暂且等待", intent: "保留判断", risk: "low" },
    ],
    stateDelta: {
      minutesElapsed: 10,
      location: null,
      occupation: null,
      moneyDelta: 0,
      healthDelta: 0,
      healthCondition: null,
      addItems: [],
      removeItemIds: [],
      relationshipDeltas: [],
      reputationDeltas: { household: 0, market: 0, administration: 0 },
      skillDeltas: { memory: 0, reasoning: 0, socialJudgment: 0, professionalPotential: 0, physical: 0, luck: 0 },
      addQuests: [],
      completeQuestIds: [],
      addRisks: [],
      resolveRiskIds: [],
      death: null,
    },
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
      output: generation(this.invalidFirst && this.generateCalls === 1 ? "S-999" : "S-004"),
    };
  }
}

class FakeRepository implements GameTurnRepository {
  readonly userId = "018f2614-326b-7e67-b42d-0f19cde35dc3";
  private committed: CommittedTurn | null = null;
  failCount = 0;
  commitCount = 0;
  private readonly session: GameSessionRecord = {
    id: sessionId,
    owner_id: this.userId,
    scenario_id: "tang-changan-742",
    character_profile: { origin: "merchant" },
    world_state: createInitialWorldState("merchant"),
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
  async createSignedUploadUrl(): Promise<string> {
    return "https://example.invalid/signed-image";
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
    expect(events.at(-1)).toBe("state.committed");
  });
});
