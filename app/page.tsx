"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChapterTimeline } from "@/components/chapter-timeline";
import { EvidenceMap } from "@/components/evidence-map";
import { IdentityPanel } from "@/components/identity-panel";
import { Phase15GameShell } from "@/components/phase15-game-shell";
import { phase7ActiveTrackLabel } from "@/lib/capabilities/phase7";
import { commitAuthoritativeSystemAction, streamGameTurn } from "@/lib/game/client";
import { getEventTemplate, getFirstEventId } from "@/lib/game/event-catalog";
import {
  type HistoricalClassification,
  type AuthoritativeSystemActionRequest,
  type TurnAction,
  type TurnChoice,
  type TurnStreamEvent,
  type WorldState,
} from "@/lib/game/schemas";
import { changanContent, sourceLabel, sourceSummary, type HistoricalOrigin } from "@/lib/historical/content";
import { signInAsGuest } from "@/lib/supabase/auth";
import { loadPublishedChanganContent } from "@/lib/supabase/historical";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getOrCreateGameSession,
  getOwnGameSession,
  rotateClientSessionId,
  updateGameCharacterProfile,
  type CharacterProfile,
  type GameSession,
} from "@/lib/supabase/saves";
import type { HistoricalContent } from "@/lib/historical/content";
import { readInitialLowMotion, useOnlineStatus } from "@/lib/ui/preferences";
import { recordClientPlaytestEvent } from "@/lib/playtest/client";
import type { ClientPlaytestEvent } from "@/lib/playtest/schemas";

type Locale = "zh" | "en" | "fr" | "el" | "ru";
type NavId = "new" | "saves" | "settings" | "support" | "playtest";
type CharacterProfileDraft = {
  origin: NonNullable<CharacterProfile["origin"]>;
  name: string;
  gender: NonNullable<CharacterProfile["gender"]>;
  temperament: NonNullable<CharacterProfile["temperament"]>;
};

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "el", label: "Ελληνικά" },
  { value: "ru", label: "Русский" },
];

const uiCopy: Record<Locale, {
  nav: Record<NavId, string>;
  lowMotion: string;
  restoreMotion: string;
  method: string;
  mapLayer: string;
  mapNote: string;
  languageNote: string;
  loaded: (title: string) => string;
}> = {
  zh: {
    nav: { new: "新开始", saves: "历史存档", settings: "个人设置", support: "支持说明", playtest: "公开测试" },
    lowMotion: "低动态",
    restoreMotion: "恢复动态",
    method: "每段内容都标明：史料记载、合理重建或叙事虚构。",
    mapLayer: "HISTORICAL MAP LAYER",
    mapNote: "图层来自已审计的阶段4内容包。几何是手绘证据示意，不能当作742年的测量边界；点击节点查看来源、时间和许可。",
    languageNote: "中文内容已完成内部校验；Phase 11 外部历史学家认证待定。其他语言仅翻译界面骨架。",
    loaded: (title) => `已载入 ${title}。第一回合尚未提交。`,
  },
  en: {
    nav: { new: "Begin", saves: "Archives", settings: "Settings", support: "Support", playtest: "Playtest" },
    lowMotion: "Low motion",
    restoreMotion: "Restore motion",
    method: "Each passage is marked as record, reconstruction, or fiction.",
    mapLayer: "HISTORICAL MAP LAYER",
    mapNote: "This audited phase-4 layer is schematic evidence, not a surveyed 742 CE boundary. Select a node to inspect sources, dates, and licensing.",
    languageNote: "Chinese content has passed internal checks; external historian certification for Phase 11 is pending. Other languages translate interface chrome only.",
    loaded: (title) => `${title} loaded. Turn one has not been submitted.`,
  },
  fr: {
    nav: { new: "Commencer", saves: "Archives", settings: "Réglages", support: "Assistance", playtest: "Test public" },
    lowMotion: "Mouvement réduit",
    restoreMotion: "Rétablir le mouvement",
    method: "Chaque passage indique : source, reconstruction ou fiction.",
    mapLayer: "COUCHE CARTOGRAPHIQUE HISTORIQUE",
    mapNote: "Cette couche auditée reste une esquisse de preuve, pas une limite mesurée en 742. Sélectionnez un nœud pour voir les sources et les licences.",
    languageNote: "Le contenu chinois a passé les contrôles internes ; la certification historique externe de la phase 11 reste en attente. Les autres langues ne traduisent que l’interface.",
    loaded: (title) => `${title} chargé. Le premier tour n'est pas soumis.`,
  },
  el: {
    nav: { new: "Νέα αρχή", saves: "Αρχεία", settings: "Ρυθμίσεις", support: "Υποστήριξη", playtest: "Δοκιμή" },
    lowMotion: "Ήπια κίνηση",
    restoreMotion: "Επαναφορά κίνησης",
    method: "Κάθε απόσπασμα σημειώνεται ως πηγή, ανακατασκευή ή μυθοπλασία.",
    mapLayer: "ΙΣΤΟΡΙΚΟ ΕΠΙΠΕΔΟ ΧΑΡΤΗ",
    mapNote: "Το ελεγμένο επίπεδο είναι σχηματικό τεκμήριο, όχι μετρημένο όριο του 742. Επιλέξτε κόμβο για πηγές, χρονολογία και άδεια.",
    languageNote: "Το κινεζικό περιεχόμενο πέρασε εσωτερικό έλεγχο· η εξωτερική ιστορική πιστοποίηση της Φάσης 11 εκκρεμεί. Οι άλλες γλώσσες καλύπτουν μόνο το περιβάλλον.",
    loaded: (title) => `Φορτώθηκε: ${title}. Ο πρώτος γύρος δεν υποβλήθηκε.`,
  },
  ru: {
    nav: { new: "Начать", saves: "Архивы", settings: "Настройки", support: "Поддержка", playtest: "Тест" },
    lowMotion: "Меньше движения",
    restoreMotion: "Вернуть движение",
    method: "Каждый фрагмент отмечен как источник, реконструкция или вымысел.",
    mapLayer: "ИСТОРИЧЕСКИЙ СЛОЙ КАРТЫ",
    mapNote: "Этот проверенный слой — схематическое свидетельство, а не измеренная граница 742 года. Выберите узел для источников, дат и лицензии.",
    languageNote: "Китайский контент прошёл внутреннюю проверку; внешняя историческая сертификация Phase 11 ожидается. Другие языки пока переводят только интерфейс.",
    loaded: (title) => `Загружено: ${title}. Первый ход ещё не отправлен.`,
  },
};

const profileTemperaments: Array<{ value: NonNullable<CharacterProfile["temperament"]>; label: string; detail: string }> = [
  { value: "谨慎", label: "谨慎", detail: "先核验，再行动" },
  { value: "好奇", label: "好奇", detail: "主动寻找线索" },
  { value: "克制", label: "克制", detail: "守住边界与风险" },
  { value: "外向", label: "外向", detail: "更快建立关系" },
];

const openingChoices: Record<string, TurnChoice[]> = {
  merchant: [
    { id: "choice-1", label: "先核对账纸上的印记", intent: "从家庭账簿寻找第一条线索", risk: "low" },
    { id: "choice-2", label: "跟随家人走向西市", intent: "进入市场与多语交易环境", risk: "medium" },
    { id: "choice-3", label: "询问今日城门开闭安排", intent: "确认通行边界与时间压力", risk: "low" },
  ],
  craft: [
    { id: "choice-1", label: "检查作坊今日的材料", intent: "从工序与材料开始学徒日程", risk: "low" },
    { id: "choice-2", label: "向师长询问交付期限", intent: "确认作坊责任与时间压力", risk: "medium" },
    { id: "choice-3", label: "观察坊区往来的商贩", intent: "理解生产与交易的联系", risk: "low" },
  ],
  clerk: [
    { id: "choice-1", label: "整理案头待抄文书", intent: "从基层行政文书进入第一回合", risk: "low" },
    { id: "choice-2", label: "询问今日递送范围", intent: "确认里坊与行政传递边界", risk: "medium" },
    { id: "choice-3", label: "核对一处含混的地名", intent: "用谨慎核验降低文书风险", risk: "low" },
  ],
};

function choicesForEvent(eventId: string | null, contentVersion = "11.0.0"): TurnChoice[] {
  if (!eventId || eventId === "legacy-session-boundary") return [];
  return getEventTemplate(eventId, contentVersion).choices.map(({ id, label, intent, risk }) => ({
    id,
    label,
    intent,
    risk,
  }));
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>ZW</span>
    </span>
  );
}

function Phase11ReleaseDisclosure() {
  return (
    <div className="release-disclosure" role="note">
      <strong>PHASE 11 · PUBLIC BETA</strong>
      <span>未经外部历史学家认证。新增章节、人物与地点仍标为 provisional；公开可玩不等于史实获批。</span>
    </div>
  );
}

function recordPlaytestUiEvent(
  input: Omit<ClientPlaytestEvent, "clientEventId">,
): void {
  const client = getSupabaseBrowserClient();
  if (client) void recordClientPlaytestEvent(client, input);
}

export default function Home() {
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [content, setContent] = useState<HistoricalContent>(changanContent);
  const [contentSource, setContentSource] = useState<"syncing" | "database" | "fallback">(() => getSupabaseBrowserClient() ? "syncing" : "fallback");
  const [contentSyncError, setContentSyncError] = useState("");
  const [selectedOrigin, setSelectedOrigin] = useState(changanContent.origins[0].id);
  const [showSetup, setShowSetup] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [characterProfile, setCharacterProfile] = useState<CharacterProfileDraft>({
    origin: changanContent.origins[0].id as CharacterProfile["origin"],
    name: "",
    gender: "unspecified",
    temperament: "谨慎",
  });
  const [gameNarrative, setGameNarrative] = useState("");
  const [gameChoices, setGameChoices] = useState<TurnChoice[]>(openingChoices.merchant);
  const [gameClassification, setGameClassification] = useState<HistoricalClassification>("叙事虚构");
  const [gameSourceIds, setGameSourceIds] = useState<string[]>([]);
  const [turnStatus, setTurnStatus] = useState<"ready" | "streaming" | "committed" | "failed">("ready");
  const [turnFailure, setTurnFailure] = useState("");
  const [customAction, setCustomAction] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [lastStateBefore, setLastStateBefore] = useState<WorldState | null>(null);
  const [lastCommitSummary, setLastCommitSummary] = useState("");
  const [systemTransactionBusy, setSystemTransactionBusy] = useState(false);
  const [systemTransactionMessage, setSystemTransactionMessage] = useState("选择事务后，将由规则引擎与数据库共同校验。");
  const [pendingTurn, setPendingTurn] = useState<{
    action: TurnAction;
    clientTurnId: string;
    expectedStateVersion: number;
  } | null>(null);
  const [language, setLanguage] = useState<Locale>(() => {
    if (typeof window === "undefined") return "zh";
    try {
      const stored = window.localStorage.getItem("chronokalamos-locale");
      return localeOptions.some((option) => option.value === stored) ? stored as Locale : "zh";
    } catch {
      return "zh";
    }
  });
  const [lowMotion, setLowMotion] = useState(readInitialLowMotion);
  const [message, setMessage] = useState("");
  const setupCloseButtonRef = useRef<HTMLButtonElement>(null);
  const online = useOnlineStatus();
  const copy = uiCopy[language];
  const origins: HistoricalOrigin[] = content.origins;
  const publishedClaimCount = content.claims.filter((claim) => claim.published).length;
  const fictionClaimCount = content.claims.filter((claim) => claim.published && claim.classification === "叙事虚构").length;
  const provisionalClaimCount = changanContent.claims.filter((claim) => claim.publicationStatus === "provisional").length;
  const worldState = gameSession?.world_state ?? null;

  const syncHistoricalContent = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setContentSource("fallback");
      return;
    }
    if (!online) {
      setContentSource("fallback");
      setContentSyncError("设备离线。当前显示本地校验包。");
      return;
    }
    setContentSource("syncing");
    setContentSyncError("");
    try {
      const nextContent = await loadPublishedChanganContent(client);
      const mergedSources = new Map(changanContent.sources.map((source) => [source.id, source]));
      nextContent.sources.forEach((source) => mergedSources.set(source.id, source));
      const mergedFeatures = new Map(changanContent.mapFeatures.map((feature) => [feature.id, feature]));
      nextContent.mapFeatures.forEach((feature) => mergedFeatures.set(feature.id, feature));
      setContent({
        ...nextContent,
        sources: [...mergedSources.values()],
        mapFeatures: [...mergedFeatures.values()],
      });
      setContentSource("database");
    } catch (error) {
      setContentSource("fallback");
      setContentSyncError(error instanceof Error ? error.message : "未知错误");
    }
  }, [online]);

  useEffect(() => {
    const timer = window.setTimeout(() => void syncHistoricalContent(), 0);
    return () => window.clearTimeout(timer);
  }, [syncHistoricalContent]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const sessionId = new URLSearchParams(window.location.search).get("session");
    const shouldStart = new URLSearchParams(window.location.search).get("start") === "1";
    const setupTimer = shouldStart
      ? window.setTimeout(() => setShowSetup(true), 0)
      : undefined;
    if (!client || !sessionId) return;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error("请先用创建该存档的身份登录。");
        const session = await getOwnGameSession(client, sessionId);
        if (!active) return;
        const profile = session.character_profile;
        if (!profile?.origin) throw new Error("存档缺少可恢复的角色出身。");
        setSelectedOrigin(profile.origin);
        setCharacterProfile({
          origin: profile.origin,
          name: profile.name ?? "未命名",
          gender: profile.gender ?? "unspecified",
          temperament: profile.temperament ?? "谨慎",
        });
        setGameSession(session);
        setGameNarrative("已从权威存档恢复。请先查看章节状态，再决定下一步。");
        setGameChoices(session.world_state.story.chapterEnding
          ? []
          : choicesForEvent(session.world_state.story.currentEventId, session.content_version));
        setGameClassification("叙事虚构");
        setGameSourceIds([]);
        setTurnStatus("ready");
        setTurnFailure("");
        setShowGame(true);
        recordPlaytestUiEvent({
          eventName: "recovery_completed",
          gameSessionId: session.id,
          recoveryPath: "save_restore",
          resultCode: "restored",
        });
      } catch (error) {
        if (active) {
          setMessage(`存档恢复失败：${error instanceof Error ? error.message : "未知错误"}`);
          recordPlaytestUiEvent({
            eventName: "client_error",
            exitPoint: "save_restore_failed",
            recoveryPath: "save_restore",
            resultCode: "save_restore_failed",
          });
        }
      }
    })();
    return () => {
      active = false;
      if (setupTimer !== undefined) window.clearTimeout(setupTimer);
    };
  }, []);

  useEffect(() => {
    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const next = Math.min(100, Math.round((elapsed / 1600) * 100));
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        finishTimer = window.setTimeout(() => setBooting(false), 160);
      }
    }, 50);

    let finishTimer: number | undefined;
    return () => {
      window.clearInterval(timer);
      if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    };
  }, []);

  useEffect(() => {
    if (!showSetup) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => setupCloseButtonRef.current?.focus(), 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeSetupWithExit();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [showSetup]);

  useEffect(() => {
    if (!showGame || !gameSession?.id) return;
    const sessionId = gameSession.id;
    function recordHiddenExit() {
      if (document.visibilityState !== "hidden") return;
      recordPlaytestUiEvent({
        eventName: "player_exit",
        gameSessionId: sessionId,
        exitPoint: "page_hidden",
        resultCode: "page_hidden",
      });
    }
    document.addEventListener("visibilitychange", recordHiddenExit);
    return () => document.removeEventListener("visibilitychange", recordHiddenExit);
  }, [gameSession?.id, showGame]);

  const selected = useMemo(
    () => origins.find((origin) => origin.id === selectedOrigin) ?? origins[0],
    [origins, selectedOrigin],
  );
  function toggleLowMotion() {
    setLowMotion((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("chronokalamos-low-motion", String(next));
      } catch {
        setMessage("浏览器拒绝保存显示偏好；本次会话仍已切换。 ");
      }
      return next;
    });
  }

  function changeLanguage(nextLanguage: Locale) {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem("chronokalamos-locale", nextLanguage);
    } catch {
      setMessage("浏览器拒绝保存语言偏好；本次会话仍已切换。 ");
    }
  }

  function updateCharacterProfile(next: Partial<CharacterProfileDraft>) {
    setCharacterProfile((current) => ({ ...current, ...next, origin: selectedOrigin as CharacterProfileDraft["origin"] }));
  }

  function openSetup() {
    setCharacterProfile((current) => ({ ...current, origin: selectedOrigin as CharacterProfileDraft["origin"] }));
    setShowSetup(true);
  }

  function closeSetupWithExit() {
    recordPlaytestUiEvent({
      eventName: "player_exit",
      exitPoint: "setup_closed",
      resultCode: "voluntary_exit",
    });
    setShowSetup(false);
  }

  async function startGame() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Supabase 未配置，阶段5不能建立权威存档或提交回合。");
      return;
    }

    const name = characterProfile.name?.trim();
    if (!name) {
      setMessage("请先给这个人一个名字。姓名是有限自定义的一部分，不会改变时代或社会边界。");
      return;
    }

    setSessionBusy(true);
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) {
        await signInAsGuest(client);
        setMessage("已创建游客身份。清除浏览器数据、退出登录或换设备后无法恢复。");
      }

      const session = await getOrCreateGameSession(client, selectedOrigin);
      const profile = {
        ...characterProfile,
        origin: selectedOrigin as CharacterProfile["origin"],
        name,
      } satisfies CharacterProfile;
      await updateGameCharacterProfile(client, session.id, profile);
      setCharacterProfile(profile);
      const hydratedSession = { ...session, character_profile: profile };
      const currentEventId = hydratedSession.world_state.story.currentEventId;
      const initialEventId = currentEventId ?? getFirstEventId(profile.origin, hydratedSession.content_version);
      setGameSession(hydratedSession);
      setGameNarrative(`${name}，你的第一天从${selected.title}开始。先观察眼前的边界，再决定哪一种行动值得留下记录。`);
      setGameChoices(
        hydratedSession.world_state.story.chapterEnding
          ? []
          : choicesForEvent(initialEventId, hydratedSession.content_version),
      );
      setGameClassification("叙事虚构");
      setGameSourceIds([]);
      setTurnStatus("ready");
      setTurnFailure("");
      setLastStateBefore(null);
      setLastCommitSummary("");
      setPendingTurn(null);
      setShowSetup(false);
      setShowGame(true);
      setMessage(`${name} 的档案已经打开。第一回合尚未提交。`);
      recordPlaytestUiEvent({
        eventName: "session_started",
        gameSessionId: hydratedSession.id,
        resultCode: "ready",
      });
    } catch (error) {
      setMessage(`无法建立权威存档：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSessionBusy(false);
    }
  }

  function handleTurnEvent(event: TurnStreamEvent) {
    if (event.event === "turn.started") {
      setTurnStatus("streaming");
      setGameNarrative("");
      setTurnFailure("");
      return;
    }
    if (event.event === "narrative.delta") {
      setGameNarrative((current) => `${current}${current ? "\n" : ""}${event.data.delta}`);
      return;
    }
    if (event.event === "choices.ready") {
      setGameChoices(event.data.choices);
      setGameSourceIds(event.data.sourceIds);
      setGameClassification(event.data.classification);
      return;
    }
    if (event.event === "state.committed") {
      setGameSession((current) => current ? {
        ...current,
        state_version: event.data.stateVersion,
        status:
          event.data.worldState.death || event.data.worldState.story.chapterEnding
            ? "ended"
            : "active",
        world_state: event.data.worldState,
        updated_at: new Date().toISOString(),
      } : current);
      setTurnStatus("committed");
      setPendingTurn(null);
      const decision = event.data.worldState.story.decisions.at(-1);
      setLastCommitSummary(
        decision?.summary
        ?? `已记录第 ${event.data.stateVersion} 个回合；状态与来源已经写入存档。`,
      );
      setMessage(event.data.duplicate
        ? "检测到重复回合编号：已回放原提交，没有再次调用模型或推进状态。"
        : `回合 ${event.data.stateVersion} 已原子提交，并建立存档点。`);
      return;
    }
    setTurnStatus("failed");
    setTurnFailure(event.data.message);
  }

  async function executeGameTurn(request: NonNullable<typeof pendingTurn>) {
    const client = getSupabaseBrowserClient();
    if (!client || !gameSession || turnStatus === "streaming" || gameSession.status === "ended") return;

    setLastStateBefore(gameSession.world_state);
    setTurnFailure("");
    setTurnStatus("streaming");
    if (!online) {
      setTurnStatus("failed");
      setTurnFailure("设备当前离线。本回合未提交；恢复网络后可安全重试。");
      return;
    }
    try {
      await streamGameTurn({
        client,
        sessionId: gameSession.id,
        request,
        onEvent: handleTurnEvent,
      });
    } catch (error) {
      setTurnStatus("failed");
      setTurnFailure(`${error instanceof Error ? error.message : "回合流失败"} 本回合未提交。`);
    }
  }

  async function submitGameAction(action: TurnAction) {
    if (!gameSession || turnStatus === "streaming" || gameSession.status === "ended") return;
    const request = {
      action,
      clientTurnId: window.crypto.randomUUID(),
      expectedStateVersion: gameSession.state_version,
    };
    setPendingTurn(request);
    await executeGameTurn(request);
  }

  async function retryPendingTurn() {
    if (!pendingTurn) return;
    recordPlaytestUiEvent({
      eventName: "recovery_attempted",
      gameSessionId: gameSession?.id,
      recoveryPath: "turn_retry",
      resultCode: "retry_requested",
    });
    await executeGameTurn(pendingTurn);
  }

  async function commitSystemAction(
    draft: Pick<AuthoritativeSystemActionRequest, "actionId" | "approach" | "parameters">,
  ) {
    const client = getSupabaseBrowserClient();
    if (!client || !gameSession || systemTransactionBusy || gameSession.status === "ended") return;
    if (!online) {
      setSystemTransactionMessage("设备离线。事务未提交；恢复网络后可重试。");
      return;
    }
    const request: AuthoritativeSystemActionRequest = {
      ...draft,
      clientActionId: window.crypto.randomUUID(),
      expectedStateVersion: gameSession.state_version,
    };
    setSystemTransactionBusy(true);
    setSystemTransactionMessage("正在校验规则并锁定存档版本…");
    setLastStateBefore(gameSession.world_state);
    try {
      const committed = await commitAuthoritativeSystemAction({
        client,
        sessionId: gameSession.id,
        request,
      });
      setGameSession((current) => current ? {
        ...current,
        state_version: committed.stateVersion,
        status: committed.worldState.story.chapterEnding ? "ended" : "active",
        world_state: committed.worldState,
        updated_at: new Date().toISOString(),
      } : current);
      setGameNarrative(committed.event.summary);
      setGameClassification(committed.event.classification);
      setGameSourceIds(committed.event.sourceIds);
      setLastCommitSummary(committed.event.consequenceLabels.join("；"));
      setSystemTransactionMessage(
        committed.duplicate
          ? "检测到重复事务编号：已返回原提交，没有再次推进状态。"
          : `事务已提交：${committed.event.consequenceLabels.join("；")}`,
      );
      setMessage(`权威事务 ${committed.stateVersion} 已原子提交，并建立存档点。`);
    } catch (error) {
      setSystemTransactionMessage(`${error instanceof Error ? error.message : "事务失败"} 数据库状态未改变。`);
    } finally {
      setSystemTransactionBusy(false);
    }
  }

  function replayCurrentOrigin() {
    rotateClientSessionId(selectedOrigin);
    setGameSession(null);
    setGameNarrative("");
    setGameChoices(
      choicesForEvent(getFirstEventId(selectedOrigin as CharacterProfile["origin"])),
    );
    setGameSourceIds([]);
    setLastStateBefore(null);
    setLastCommitSummary("");
    setPendingTurn(null);
    setTurnStatus("ready");
    setTurnFailure("");
    setCustomAction("");
    setShowGame(false);
    setShowSetup(true);
    setMessage("已保留旧存档，并为当前出身建立新的重玩入口。");
  }

  if (booting) {
    return (
      <main className="boot-screen" aria-label="ChronoKalamos 正在载入">
        <div className="boot-copy">
          <span className="eyebrow">ΧΡΟΝΟΚΑΛΑΜΟΣ · ARCHIVE PROTOCOL</span>
          <p className="boot-title">把时间写回一座城市。</p>
          <p className="boot-subtitle">Evidence-bound AI historical life simulator</p>
        </div>
        <div className="boot-progress" aria-label={`载入进度 ${progress}%`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="boot-meta"><span>742 CE · CHANG’AN</span><span>{String(progress).padStart(3, "0")} / 100</span></div>
        <button className="text-button boot-skip" type="button" onClick={() => { setProgress(100); setBooting(false); }}>跳过启动</button>
      </main>
    );
  }

  if (showGame) {
    const state = worldState;
    if (!state || !gameSession) {
      return (
        <main className="game-shell">
          <p className="inline-message" role="status">正在恢复权威存档…</p>
        </main>
      );
    }
    return (
      <Phase15GameShell
        state={state}
        previousState={lastStateBefore}
        session={gameSession}
        content={content}
        contentSource={contentSource}
        contentError={contentSyncError}
        selectedTitle={selected.title}
        characterProfile={characterProfile}
        narrative={gameNarrative}
        choices={gameChoices}
        classification={gameClassification}
        sourceIds={gameSourceIds}
        turnStatus={turnStatus}
        turnFailure={turnFailure}
        hasPendingTurn={Boolean(pendingTurn)}
        lastCommitSummary={lastCommitSummary}
        customAction={customAction}
        lowMotion={lowMotion}
        online={online}
        lowMotionLabel={lowMotion ? copy.restoreMotion : copy.lowMotion}
        onCustomActionChange={setCustomAction}
        onSubmitAction={submitGameAction}
        onCommitSystemAction={commitSystemAction}
        systemTransactionBusy={systemTransactionBusy}
        systemTransactionMessage={systemTransactionMessage}
        onRetryTurn={retryPendingTurn}
        onRetryContent={() => void syncHistoricalContent()}
        onReplay={replayCurrentOrigin}
        onToggleLowMotion={toggleLowMotion}
        onExit={() => {
          recordPlaytestUiEvent({
            eventName: "player_exit",
            gameSessionId: gameSession.id,
            exitPoint: "game_back_home",
            resultCode: "voluntary_exit",
          });
          setShowGame(false);
        }}
      />
    );
  }

  return (
    <main className={`site-frame ${lowMotion ? "low-motion" : ""}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="masthead">
        <Link className="brand" href="/"><BrandMark /><span className="brand-copy"><strong>CHRONOKALAMOS</strong><small>史料边界 · A LIFE IN RECORD</small></span></Link>
        <nav className="mast-nav" aria-label="主导航">
          <span className="edition"><span className="status-dot" />PHASE 14 · SMALL BETA</span>
          <label className="language-select"><span className="sr-only">选择语言</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Locale)}>{localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button className="text-button" type="button" aria-pressed={lowMotion} onClick={toggleLowMotion}>{lowMotion ? copy.restoreMotion : copy.lowMotion}</button>
        </nav>
      </header>
      {!online && <div className="network-banner" role="alert"><strong>当前离线</strong><span>证据镜像和身份状态可能不是最新；恢复网络后可重试同步。</span></div>}
      <Phase11ReleaseDisclosure />

      <div id="main-content" className="site-layout" tabIndex={-1}>
        <aside className="side-nav" aria-label="账户与存档">
          <p className="side-kicker">ARCHIVE / 01</p>
          <div className="side-links">
            <button className="side-link active" type="button" onClick={openSetup}><span>{copy.nav.new}</span><small>Begin</small></button>
            <Link className="side-link" href="/saves"><span>{copy.nav.saves}</span><small>Archives</small></Link>
            <Link className="side-link" href="/settings"><span>{copy.nav.settings}</span><small>Settings</small></Link>
            <Link className="side-link" href="/support"><span>{copy.nav.support}</span><small>Support</small></Link>
            <Link className="side-link" href="/playtest"><span>{copy.nav.playtest}</span><small>Playtest</small></Link>
          </div>
          <div className="side-note"><span className="eyebrow">METHOD</span><p>{copy.method}</p></div>
        </aside>

        <div className="map-column">
          <EvidenceMap
            features={content.mapFeatures}
            sources={content.sources}
            contentSource={contentSource}
            contentError={contentSyncError}
            currentEventId={gameSession?.world_state.story.currentEventId ?? getFirstEventId(selectedOrigin as CharacterProfile["origin"])}
            onRetry={() => void syncHistoricalContent()}
          />
          <ChapterTimeline
            originId={selectedOrigin as CharacterProfile["origin"]}
            currentEventId={gameSession?.world_state.story.currentEventId ?? getFirstEventId(selectedOrigin as CharacterProfile["origin"])}
            completedEventIds={gameSession?.world_state.story.completedEventIds ?? []}
            turn={gameSession?.world_state.time.turn ?? 0}
          />
        </div>

        <aside className="login-sheet" aria-label="游客入口">
          <span className="sheet-tab">IDENTITY BOUNDARY</span><p className="sheet-label">ARCHIVE GATE / 03</p><h2>先留下一个入口。</h2><p className="sheet-copy">游客与邮箱账户使用同一用户 ID 升级路径。数据库和私有文件均由 RLS 限定为本人可见。</p>
          <IdentityPanel originId={selectedOrigin} onGuestStarted={() => setShowSetup(true)} onMessage={setMessage} />
          <div className="in-prep"><span>阶段 7 / 7</span><span>{phase7ActiveTrackLabel}</span></div>
        </aside>
      </div>

      <section className="origin-deck" aria-labelledby="origins-title">
        <div className="origin-intro"><p className="eyebrow">FIRST RECORDED LIFE</p><h2 id="origins-title">三种出身，三个证据入口。</h2><p>先选择社会位置，再让故事获得边界。</p></div>
        {origins.map((origin) => <label className={`origin-card ${selectedOrigin === origin.id ? "selected" : ""}`} key={origin.id}><input type="radio" name="origin" value={origin.id} checked={selectedOrigin === origin.id} onChange={() => setSelectedOrigin(origin.id)} /><span className="origin-sigil" aria-hidden="true">{origin.code.slice(-1)}</span><span><span className="origin-code">{origin.code}</span><strong>{origin.title}</strong><small>{origin.english}</small><p>{origin.detail}</p><em>{sourceLabel(origin.classification)} · {sourceSummary(origin.sourceIds)}</em></span><span className="origin-arrow" aria-hidden="true">↗</span></label>)}
      </section>

      <footer className="status-bar"><span><strong>史料边界：</strong> 已发布 {publishedClaimCount} 条 · Phase 11 provisional {provisionalClaimCount} 条 · 叙事虚构 {fictionClaimCount} 条</span><span>{copy.languageNote} · {contentSource === "database" ? "基础证据来自 Supabase 已发布镜像" : "基础证据来自本地校验包"} · 16+ · No real payments</span></footer>

      {showSetup && <div className="setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeSetupWithExit(); }}><section className="setup-sheet" role="dialog" aria-modal="true" aria-labelledby="setup-title" aria-describedby="setup-description"><div className="setup-header"><div><p className="eyebrow">NEW SESSION / 742 CE</p><h2 id="setup-title">把时间落在一个人身上。</h2></div><button ref={setupCloseButtonRef} className="icon-button" type="button" aria-label="关闭设定" onClick={closeSetupWithExit}>×</button></div><p id="setup-description" className="setup-copy">这是有限自定义的首发模板。你可以调整姓名、性别和性格；时代、地点与社会边界不会被自由输入覆盖。</p><div className="setup-options">{origins.map((origin) => <button type="button" className={selectedOrigin === origin.id ? "setup-option selected" : "setup-option"} key={origin.id} aria-pressed={selectedOrigin === origin.id} onClick={() => { setSelectedOrigin(origin.id); updateCharacterProfile({ origin: origin.id as CharacterProfile["origin"] }); }}><span>{origin.code}</span><strong>{origin.title}</strong><small>{origin.detail}</small></button>)}</div><div className="profile-fields"><label htmlFor="character-name">姓名<input id="character-name" name="character-name" type="text" maxLength={40} placeholder="例如：阿史那·..." value={characterProfile.name} onChange={(event) => updateCharacterProfile({ name: event.target.value })} /></label><label htmlFor="character-gender">性别<select id="character-gender" value={characterProfile.gender} onChange={(event) => updateCharacterProfile({ gender: event.target.value as CharacterProfile["gender"] })}><option value="unspecified">不预设</option><option value="female">女性</option><option value="male">男性</option><option value="nonbinary">不二元</option></select></label><div className="temperament-field"><span>性格倾向</span><div>{profileTemperaments.map((item) => <button key={item.value} className={characterProfile.temperament === item.value ? "temperament-choice selected" : "temperament-choice"} type="button" aria-pressed={characterProfile.temperament === item.value} onClick={() => updateCharacterProfile({ temperament: item.value })}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></div></div><div className="setup-footer"><span><strong>标签：</strong>{sourceLabel(selected.classification)} · {sourceSummary(selected.sourceIds)}</span><button className="primary-button" type="button" onClick={() => void startGame()} disabled={sessionBusy || !characterProfile.name.trim()}>{sessionBusy ? "正在建立存档…" : "确认并进入"}</button></div></section></div>}
      {message && !showSetup && <div className="toast" role="status">{message}<button className="icon-button" type="button" aria-label="关闭提示" onClick={() => setMessage("")}>×</button></div>}
    </main>
  );
}
