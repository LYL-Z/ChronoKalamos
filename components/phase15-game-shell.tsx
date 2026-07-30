"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterTimeline } from "@/components/chapter-timeline";
import { CinematicNarrative } from "@/components/cinematic-narrative";
import { EvidenceMap } from "@/components/evidence-map";
import { getPublishedCinematicScene } from "@/lib/game/cinematic";
import {
  getChoiceDisclosure,
  getDayCycleState,
  getModuleDescriptors,
  getSocialPosition,
  type Phase15ModuleId,
} from "@/lib/game/phase15-simulation";
import type {
  HistoricalClassification,
  TurnAction,
  TurnChoice,
  WorldState,
} from "@/lib/game/schemas";
import {
  sourceLabel,
  sourceSummary,
  type HistoricalContent,
} from "@/lib/historical/content";
import type { GameSession } from "@/lib/supabase/saves";

type Phase15GameShellProps = {
  state: WorldState;
  previousState: WorldState | null;
  session: GameSession;
  content: HistoricalContent;
  contentSource: "syncing" | "database" | "fallback";
  contentError: string;
  selectedTitle: string;
  characterProfile: {
    name: string;
    temperament: string;
  };
  narrative: string;
  choices: TurnChoice[];
  classification: HistoricalClassification;
  sourceIds: string[];
  turnStatus: "ready" | "streaming" | "committed" | "failed";
  turnFailure: string;
  hasPendingTurn: boolean;
  lastCommitSummary: string;
  customAction: string;
  lowMotion: boolean;
  online: boolean;
  lowMotionLabel: string;
  onCustomActionChange: (value: string) => void;
  onSubmitAction: (action: TurnAction) => Promise<void>;
  onRetryTurn: () => Promise<void>;
  onRetryContent: () => void;
  onReplay: () => void;
  onToggleLowMotion: () => void;
  onExit: () => void;
};

const skillLabels: Record<keyof WorldState["skills"], string> = {
  memory: "记忆",
  reasoning: "推理",
  socialJudgment: "社交判断",
  professionalPotential: "专业潜能",
  physical: "体能",
  luck: "幸运",
};

const shortcutModules: Record<string, Phase15ModuleId> = {
  m: "map",
  p: "attributes",
  b: "inventory",
  r: "relations",
  j: "quests",
};

function formatWorldTime(time: WorldState["time"]): string {
  const season = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" }[time.season];
  const hour = Math.floor(time.minuteOfDay / 60).toString().padStart(2, "0");
  const minute = (time.minuteOfDay % 60).toString().padStart(2, "0");
  return `天宝元年 · ${season} · 日序 ${String(time.dayOfYear).padStart(3, "0")} · ${hour}:${minute}`;
}

function signedDelta(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='dialog']"));
}

function ArchiveBrand() {
  return (
    <Link className="phase15-brand" href="/" aria-label="ChronoKalamos 首页">
      <span className="phase15-seal" aria-hidden="true">ZW</span>
      <span>
        <strong>CHRONOKALAMOS</strong>
        <small>史料边界 · 742 长安</small>
      </span>
    </Link>
  );
}

function Meter({ label, value, min = 0, max = 10 }: { label: string; value: number; min?: number; max?: number }) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="phase15-meter">
      <span>{label}</span>
      <i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></i>
      <strong>{value}</strong>
    </div>
  );
}

export function Phase15GameShell({
  state,
  previousState,
  session,
  content,
  contentSource,
  contentError,
  selectedTitle,
  characterProfile,
  narrative,
  choices,
  classification,
  sourceIds,
  turnStatus,
  turnFailure,
  hasPendingTurn,
  lastCommitSummary,
  customAction,
  lowMotion,
  online,
  lowMotionLabel,
  onCustomActionChange,
  onSubmitAction,
  onRetryTurn,
  onRetryContent,
  onReplay,
  onToggleLowMotion,
  onExit,
}: Phase15GameShellProps) {
  const [activeModule, setActiveModule] = useState<Phase15ModuleId>(
    state.socialIdentity === "clerk" ? "livelihood" : "map",
  );
  const [evidenceMode, setEvidenceMode] = useState(false);
  const actionDocketRef = useRef<HTMLElement>(null);
  const modules = useMemo(() => getModuleDescriptors(state), [state]);
  const dayCycle = useMemo(() => getDayCycleState(state), [state]);
  const position = useMemo(() => getSocialPosition(state), [state]);
  const cinematicScene = getPublishedCinematicScene(state.story.currentEventId);
  const activeRiskClocks = state.story.riskClocks.filter((clock) => clock.status !== "resolved");
  const recentMemories = state.story.relationshipMemories.slice(-8).reverse();
  const chapterEnded = Boolean(state.story.chapterEnding);
  const cashDelta = previousState ? state.money.cash - previousState.money.cash : 0;
  const vitalityDelta = previousState ? state.health.vitality - previousState.health.vitality : 0;
  const daySettled = previousState
    ? state.time.dayOfYear > previousState.time.dayOfYear
    : state.time.turn > 0 && state.time.turn % 3 === 0;
  const originTheme = `phase15-origin-${state.socialIdentity}`;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      const moduleId = shortcutModules[event.key.toLowerCase()];
      if (moduleId) {
        event.preventDefault();
        setActiveModule(moduleId);
        document.querySelector<HTMLElement>("#phase15-module-content")?.focus();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        actionDocketRef.current?.focus();
        actionDocketRef.current?.scrollIntoView({ block: "nearest", behavior: lowMotion ? "auto" : "smooth" });
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [lowMotion]);

  function renderModule() {
    if (activeModule === "map") {
      return (
        <div className="phase15-map-panel">
          <div className="phase15-module-intro">
            <div>
              <span className="eyebrow">MICRO MAP · EVIDENCE BOUNDED</span>
              <h2>长安坊市证据图层</h2>
            </div>
            <p><strong>8 个已发布地点</strong>。108 坊只作为未来证据索引目标。当前不宣称完整或精确复原。</p>
          </div>
          <EvidenceMap
            features={content.mapFeatures}
            sources={content.sources}
            contentSource={contentSource}
            contentError={contentError}
            currentEventId={state.story.currentEventId}
            onRetry={onRetryContent}
          />
        </div>
      );
    }

    if (activeModule === "attributes") {
      return (
        <section className="phase15-document-panel" aria-labelledby="phase15-attributes-title">
          <header>
            <span className="eyebrow">CHARACTER DOSSIER</span>
            <h2 id="phase15-attributes-title">人物属性与身份边界</h2>
            <p>这些是游戏内 1—10 级表现，不是现代心理测验或历史人口统计。</p>
          </header>
          <div className="phase15-triple-grid">
            <article>
              <h3>基础状态</h3>
              <Meter label="健康" value={state.health.vitality} />
              <Meter label="精力" value={state.energy.current} max={state.energy.max} />
              <Meter label="士气" value={state.morale} />
              <small>{state.health.condition} · 本日 {dayCycle.usedSlots}/3 行动已用</small>
            </article>
            <article>
              <h3>能力记录</h3>
              {(Object.entries(state.skills) as Array<[keyof WorldState["skills"], number]>).map(([key, value]) =>
                <Meter key={key} label={skillLabels[key]} value={value} />
              )}
            </article>
            <article>
              <h3>社会位置</h3>
              <dl className="phase15-dossier-list">
                <div><dt>层级</dt><dd>{position.stratum}</dd></div>
                <div><dt>身份</dt><dd>{position.standingLabel}</dd></div>
                <div><dt>权限</dt><dd>{position.institutionalAccess}</dd></div>
                <div><dt>边界</dt><dd>{position.evidenceBoundary}</dd></div>
              </dl>
            </article>
          </div>
        </section>
      );
    }

    if (activeModule === "inventory") {
      return (
        <section className="phase15-document-panel" aria-labelledby="phase15-inventory-title">
          <header>
            <span className="eyebrow">INVENTORY LEDGER</span>
            <h2 id="phase15-inventory-title">背包与持有物</h2>
            <p>只展示已经由规则事务提交的物品。内容包中的物件不会自动成为玩家所有物。</p>
          </header>
          {state.items.length ? (
            <div className="phase15-card-grid">
              {state.items.map((item) => (
                <article key={item.id} className="phase15-record-card">
                  <span>{item.id}</span>
                  <strong>{item.label}</strong>
                  <small>数量 × {item.quantity} · 已提交状态</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="phase15-empty-state" role="status">
              <strong>尚无已提交物品。</strong>
              <span>选择结果只有在规则明确授予物品并完成事务后，才会进入此处。</span>
            </div>
          )}
        </section>
      );
    }

    if (activeModule === "relations") {
      const relationIds = new Set([
        ...state.relationships.map((relation) => relation.id),
        ...recentMemories.map((memory) => memory.relationshipId),
      ]);
      return (
        <section className="phase15-document-panel" aria-labelledby="phase15-relations-title">
          <header>
            <span className="eyebrow">RELATIONSHIP MEMORY</span>
            <h2 id="phase15-relations-title">人际关系与事件记忆</h2>
            <p>关系数值不能替代事件证据。记忆只来自已经提交的编辑后果。</p>
          </header>
          {relationIds.size ? (
            <div className="phase15-relation-grid">
              {[...relationIds].map((id) => {
                const relation = state.relationships.find((candidate) => candidate.id === id);
                const memories = recentMemories.filter((memory) => memory.relationshipId === id);
                return (
                  <article key={id} className="phase15-relation-card">
                    <div><span>{id}</span><strong>{relation?.label ?? "事件人物"}</strong><em>{relation?.affinity ?? 0}</em></div>
                    {memories.length
                      ? memories.map((memory) => <p key={`${memory.eventId}-${memory.turn}`}>{memory.summary}<small>回合 {memory.turn} · {memory.valence}</small></p>)
                      : <p>尚无已提交关系记忆。</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="phase15-empty-state" role="status">
              <strong>关系尚未形成。</strong>
              <span>这不是缺失数据。第一条关系会在事件后果完成提交时出现。</span>
            </div>
          )}
        </section>
      );
    }

    if (activeModule === "livelihood") {
      return (
        <section className="phase15-document-panel" aria-labelledby="phase15-duty-title">
          <header>
            <span className="eyebrow">DAILY DUTY · THREE ACTIONS</span>
            <h2 id="phase15-duty-title">{state.socialIdentity === "clerk" ? "公务簿" : "营生簿"}</h2>
            <p>一天固定三个行动位。第三次提交同时完成确定性日结，不触发额外 AI 或数据库写入。</p>
          </header>
          <div className="phase15-duty-summary">
            <article>
              <span>当前职业</span>
              <strong>{state.occupation ?? "未定"}</strong>
              <small>{state.location.label}</small>
            </article>
            <article>
              <span>本日行动</span>
              <strong>{dayCycle.usedSlots} / 3</strong>
              <small>{dayCycle.settlementLabel}</small>
            </article>
            <article>
              <span>当前事件</span>
              <strong>{state.story.currentEventId}</strong>
              <small>{state.story.chapterId}</small>
            </article>
          </div>
          <ChapterTimeline
            originId={state.socialIdentity}
            contentVersion={session.content_version}
            currentEventId={state.story.currentEventId}
            completedEventIds={state.story.completedEventIds}
            turn={state.time.turn}
          />
        </section>
      );
    }

    if (activeModule === "quests") {
      return (
        <section className="phase15-document-panel" aria-labelledby="phase15-quests-title">
          <header>
            <span className="eyebrow">DUTIES & RISK CLOCKS</span>
            <h2 id="phase15-quests-title">任务与风险</h2>
            <p>风险钟是编辑规则，不是模型猜测。达到阈值后的后果仍需模板明确声明。</p>
          </header>
          <div className="phase15-split-list">
            <article>
              <h3>任务</h3>
              {state.quests.length
                ? state.quests.map((quest) => <p key={quest.id}><strong>{quest.label}</strong><span>{quest.status}</span></p>)
                : <div className="phase15-empty-state"><strong>暂无任务。</strong><span>等待已提交事件授予。</span></div>}
            </article>
            <article>
              <h3>风险钟</h3>
              {activeRiskClocks.length
                ? activeRiskClocks.map((clock) => (
                  <div className="phase15-risk-row" key={clock.id}>
                    <p><strong>{clock.label}</strong><span>{clock.status}</span></p>
                    <i><b style={{ width: `${Math.min(100, (clock.progress / clock.threshold) * 100)}%` }} /></i>
                    <small>{clock.progress} / {clock.threshold}</small>
                  </div>
                ))
                : <div className="phase15-empty-state"><strong>暂无未解风险。</strong><span>风险不会仅为增加紧张感而伪造。</span></div>}
            </article>
          </div>
        </section>
      );
    }

    return (
      <section className="phase15-document-panel" aria-labelledby="phase15-household-title">
        <header>
          <span className="eyebrow">HOUSEHOLD DOSSIER</span>
          <h2 id="phase15-household-title">家户与出身档案</h2>
          <p>当前切片只记录出身家户影响，不实现婚姻、生育、宗族扩张或跨代继承。</p>
        </header>
        <div className="phase15-household-sheet">
          <div>
            <span className="eyebrow">ORIGIN RECORD</span>
            <strong>{selectedTitle}</strong>
            <small>{characterProfile.name || "未命名角色"} · {characterProfile.temperament}</small>
          </div>
          <dl className="phase15-dossier-list">
            <div><dt>家户声望</dt><dd>{signedDelta(state.reputation.household)}</dd></div>
            <div><dt>社会位置</dt><dd>{position.standingLabel}</dd></div>
            <div><dt>可进入网络</dt><dd>{position.institutionalAccess}</dd></div>
            <div><dt>明确排除</dt><dd>{position.evidenceBoundary}</dd></div>
          </dl>
        </div>
      </section>
    );
  }

  return (
    <main className={`phase15-shell ${originTheme} ${lowMotion ? "low-motion" : ""}`}>
      <a className="skip-link" href="#phase15-module-content">跳到游戏内容</a>
      <header className="phase15-topbar">
        <ArchiveBrand />
        <div className="phase15-time-block">
          <span>{formatWorldTime(state.time)}</span>
          <strong>第 {dayCycle.dayIndex} 日 · 行动 {dayCycle.usedSlots}/3</strong>
        </div>
        <nav aria-label="游戏全局操作">
          <button type="button" className={evidenceMode ? "active" : ""} aria-pressed={evidenceMode} onClick={() => setEvidenceMode((value) => !value)}>证据视图</button>
          <Link href="/saves">存档</Link>
          <Link href="/settings">设置</Link>
          <button type="button" aria-pressed={lowMotion} onClick={onToggleLowMotion}>{lowMotionLabel}</button>
          <button type="button" onClick={onExit}>退出</button>
        </nav>
      </header>
      <h1 className="sr-only">ChronoKalamos 742 年长安档案模拟</h1>

      {!online && (
        <div className="phase15-network-banner" role="alert">
          <strong>当前离线。</strong>
          <span>可查看最后载入的存档，但不能提交行动。恢复网络后可用同一 clientTurnId 重试。</span>
        </div>
      )}

      <div className="phase15-review-strip" role="note">
        <strong>PUBLIC BETA · HISTORIAN REVIEW PENDING</strong>
        <span>Phase 11 内容仍为 provisional。公开可玩不等于史实获批。</span>
        <small>CONTENT {session.content_version} · SESSION {session.id.slice(0, 8)} · STATE v{session.state_version}</small>
      </div>

      <div className="phase15-workspace">
        <aside className="phase15-module-nav" aria-label="游戏系统">
          <span className="phase15-archive-index">ARCHIVE / 15</span>
          {modules.map((module, index) => (
            <button
              key={module.id}
              type="button"
              className={activeModule === module.id ? "active" : ""}
              aria-current={activeModule === module.id ? "page" : undefined}
              onClick={() => setActiveModule(module.id)}
            >
              <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
              <span><strong>{module.label}</strong><small>{module.eyebrow}</small></span>
              <em>{module.count}</em>
              {module.shortcut && <kbd>{module.shortcut}</kbd>}
            </button>
          ))}
          <div className="phase15-position-note">
            <span>{position.stratum}</span>
            <strong>{position.standingLabel}</strong>
            <small>{position.evidenceBoundary}</small>
          </div>
        </aside>

        <section
          id="phase15-module-content"
          className={`phase15-module-content ${evidenceMode ? "evidence-mode" : ""}`}
          tabIndex={-1}
          aria-live="polite"
        >
          {evidenceMode && (
            <div className="phase15-evidence-banner">
              <span>{sourceLabel(classification)}</span>
              <strong>{sourceIds.length ? sourceSummary(sourceIds) : "当前候选叙事尚无已提交引用"}</strong>
              <small>可信度、出版状态与地理不确定性分开显示，不能相互替代。</small>
            </div>
          )}
          {renderModule()}
        </section>

        <aside
          id="phase15-action-docket"
          ref={actionDocketRef}
          className="phase15-action-docket"
          tabIndex={-1}
          aria-labelledby="phase15-action-title"
        >
          <header>
            <span className="eyebrow">CURRENT ACTION · TURN {String(state.time.turn).padStart(2, "0")}</span>
            <h2 id="phase15-action-title">
              {turnStatus === "failed"
                ? "本回合未提交"
                : turnStatus === "streaming"
                  ? "正在核验行动"
                  : "当前事件"}
            </h2>
            <small>{state.location.label} · {sourceLabel(classification)}</small>
          </header>

          <CinematicNarrative
            scene={cinematicScene}
            sceneNumber={String(state.time.turn).padStart(2, "0")}
            locationLabel={state.location.label}
            classificationLabel={sourceLabel(classification)}
            sourceSummary={sourceIds.length ? sourceSummary(sourceIds) : "待首回合引用"}
            narrative={narrative}
          />

          {daySettled && turnStatus === "committed" && (
            <div className="phase15-settlement-card" role="status">
              <strong>日结完成</strong>
              <span>已进入第 {dayCycle.dayIndex} 日 06:00。精力恢复为 {state.energy.current}/{state.energy.max}。</span>
              <small>第三次行动与日结共用一次事务，没有额外模型调用。</small>
            </div>
          )}
          {lastCommitSummary && turnStatus === "committed" && (
            <div className="phase15-recap-card" role="status">
              <strong>{lastCommitSummary}</strong>
              <small>钱财 {signedDelta(cashDelta)} · 健康 {signedDelta(vitalityDelta)}</small>
            </div>
          )}
          {turnFailure && (
            <div className="phase15-turn-failure" role="alert">
              <strong>状态未改变</strong>
              <span>{turnFailure}</span>
              {hasPendingTurn && <button type="button" onClick={() => void onRetryTurn()} disabled={!online || turnStatus === "streaming"}>用原回合编号重试</button>}
            </div>
          )}

          {chapterEnded && state.story.chapterEnding ? (
            <section className="phase15-ending">
              <span className="eyebrow">{sourceLabel(state.story.chapterEnding.classification)}</span>
              <h3>{state.story.chapterEnding.title}</h3>
              <p>{state.story.chapterEnding.summary}</p>
              <button type="button" onClick={onReplay}>保留记录，重玩这一出身</button>
            </section>
          ) : (
            <>
              <div className="phase15-choice-list" aria-label="可提交行动">
                {choices.map((choice) => {
                  const disclosure = getChoiceDisclosure(state, choice.id, session.content_version);
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={turnStatus === "streaming" || !online}
                      onClick={() => void onSubmitAction({
                        kind: "choice",
                        choiceId: choice.id as `choice-${1 | 2 | 3 | 4 | 5}`,
                        text: choice.label,
                      })}
                    >
                      <span><i>{choice.id.slice(-1)}</i><strong>{choice.label}</strong></span>
                      <small>{choice.intent}</small>
                      <em>
                        1 行动 · 约 {disclosure.minutes} 分 · 风险 {disclosure.risk}
                        {disclosure.moneyCost ? ` · 支出 ${disclosure.moneyCost} 文` : ""}
                        {disclosure.affectedDomains.length ? ` · 影响 ${disclosure.affectedDomains.join("、")}` : ""}
                      </em>
                    </button>
                  );
                })}
              </div>
              <form
                className="phase15-free-action"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (customAction.trim()) void onSubmitAction({ kind: "free_text", text: customAction.trim() });
                }}
              >
                <label htmlFor="phase15-custom-action">自由行动</label>
                <textarea
                  id="phase15-custom-action"
                  value={customAction}
                  onChange={(event) => onCustomActionChange(event.target.value)}
                  placeholder="描述符合当前身份、地点与时代边界的行动。"
                  maxLength={1000}
                  disabled={turnStatus === "streaming" || !online}
                />
                <div><span>{customAction.length}/1000 · 将映射到本事件允许的安全选择</span><button type="submit" disabled={!customAction.trim() || turnStatus === "streaming" || !online}>提交行动</button></div>
              </form>
            </>
          )}
          <p className="phase15-input-boundary">图片、短信、微信、QQ、支付与 Passkey 均未启用。DeepSeek 只负责受控叙事表达。</p>
        </aside>
      </div>

      <footer className="phase15-statusbar" aria-label="常驻游戏状态">
        <div><span>钱财</span><strong>{state.money.cash} 文</strong><small>{signedDelta(cashDelta)}</small></div>
        <div><span>精力</span><strong>{state.energy.current}/{state.energy.max}</strong><small>{dayCycle.settlementLabel}</small></div>
        <div><span>健康</span><strong>{state.health.vitality}/10</strong><small>{state.health.condition}</small></div>
        <div><span>士气</span><strong>{state.morale}/10</strong><small>规则状态</small></div>
        <div><span>声望</span><strong>{state.socialIdentity === "merchant" ? state.reputation.market : state.socialIdentity === "clerk" ? state.reputation.administration : state.reputation.household}</strong><small>{position.stratum}</small></div>
        <div className="phase15-day-slots">
          <span>本日行动</span>
          <span className="phase15-slot-meter" role="img" aria-label={`已使用 ${dayCycle.usedSlots} 个，共 3 个`}>
            {[0, 1, 2].map((slot) => <b key={slot} className={slot < dayCycle.usedSlots ? "used" : ""} />)}
          </span>
          <small>空格：聚焦行动，不自动提交</small>
        </div>
      </footer>
    </main>
  );
}
