"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  canUsePhase17Action,
  getPhase17Stratum,
  phase17ChanganCells,
  phase17Circuits,
  phase17CourtInstitutions,
  phase17Endings,
  phase17FamilyRules,
  phase17ItemCatalog,
  phase17PalaceRanks,
  phase17Scale,
  phase17Strata,
  phase17SystemActions,
  phase17Wards,
} from "@/lib/game/phase17-world";
import {
  canApplyAuthoritativeSystemAction,
  getPhase18EndingEligibility,
  phase18ActionCatalog,
} from "@/lib/game/phase18-authority";
import type {
  AuthoritativeSystemActionId,
  AuthoritativeSystemActionRequest,
  SystemApproach,
  WorldState,
} from "@/lib/game/schemas";

const tabs = [
  ["strata", "七阶层"],
  ["changan", "长安坊市"],
  ["realm", "天下十五道"],
  ["court", "朝政"],
  ["palace", "内廷"],
  ["family", "家户婚育"],
  ["items", "物品目录"],
  ["endings", "结局档案"],
] as const;

type Phase17Tab = (typeof tabs)[number][0];

type Phase17WorldSystemsProps = {
  state: WorldState;
  onClose: () => void;
  onDraftAction: (draft: string) => void;
  onCommitAction: (action: Pick<AuthoritativeSystemActionRequest, "actionId" | "approach" | "parameters">) => Promise<void>;
  transactionBusy: boolean;
  transactionMessage: string;
};

function BoundaryNote({ children }: { children: React.ReactNode }) {
  return <p className="phase17-boundary-note" role="note">{children}</p>;
}

function ActionRegister({ state, domain, onDraftAction }: {
  state: WorldState;
  domain: "livelihood" | "court" | "palace" | "family";
  onDraftAction: (draft: string) => void;
}) {
  return (
    <div className="phase17-action-register">
      {phase17SystemActions.filter((action) => action.domain === domain).map((action) => {
        const permission = canUsePhase17Action(state, action);
        return (
          <article key={action.id}>
            <span>{action.classification} · {action.sourceIds.join(" / ")}</span>
            <strong>{action.label}</strong>
            <p>{action.actionDraft}</p>
            <small>{action.cost} · 可能影响：{action.directionalEffects.join("、")}</small>
            <button
              type="button"
              disabled={!permission.allowed}
              title={permission.reason}
              onClick={() => onDraftAction(action.actionDraft)}
            >
              {permission.allowed ? "写入行动草案" : permission.reason}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function Phase17WorldSystems({
  state,
  onClose,
  onDraftAction,
  onCommitAction,
  transactionBusy,
  transactionMessage,
}: Phase17WorldSystemsProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<Phase17Tab>("strata");
  const [query, setQuery] = useState("");
  const [itemCategory, setItemCategory] = useState("全部");
  const [endingGroup, setEndingGroup] = useState("全部");
  const [selectedCircuit, setSelectedCircuit] = useState(phase17Circuits[0].id);
  const [selectedCell, setSelectedCell] = useState(phase17ChanganCells[0].id);
  const [approach, setApproach] = useState<SystemApproach>("prudent");
  const [actorAge, setActorAge] = useState(20);
  const [partnerLabel, setPartnerLabel] = useState("");
  const [partnerAge, setPartnerAge] = useState(20);
  const [mutualConsent, setMutualConsent] = useState(false);
  const [childLabel, setChildLabel] = useState("");
  const [childAge, setChildAge] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState("p17-flatbread-ration");
  const currentStratum = useMemo(() => getPhase17Stratum(state), [state]);
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const itemCategories = useMemo(
    () => ["全部", ...new Set(phase17ItemCatalog.map((item) => item.category))],
    [],
  );
  const endingGroups = useMemo(
    () => ["全部", ...new Set(phase17Endings.map((ending) => ending.group))],
    [],
  );
  const visibleItems = useMemo(
    () => phase17ItemCatalog.filter((item) =>
      (itemCategory === "全部" || item.category === itemCategory)
      && (!normalizedQuery || `${item.name}${item.id}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
    ),
    [itemCategory, normalizedQuery],
  );
  const visibleEndings = useMemo(
    () => phase17Endings.filter((ending) =>
      (endingGroup === "全部" || ending.group === endingGroup)
      && (!normalizedQuery || `${ending.title}${ending.summary}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
    ),
    [endingGroup, normalizedQuery],
  );
  const selectedWardCell = phase17ChanganCells.find((cell) => cell.id === selectedCell) ?? phase17ChanganCells[0];
  const selectedWard = phase17Wards.find((ward) => ward.id === selectedWardCell.id);
  const circuit = phase17Circuits.find((candidate) => candidate.id === selectedCircuit) ?? phase17Circuits[0];

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>(".phase17-tabs button")?.focus();
    return () => previousFocusRef.current?.focus();
  }, []);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function authorityButton(
    actionId: AuthoritativeSystemActionId,
    parameters: AuthoritativeSystemActionRequest["parameters"] = {},
    label?: string,
  ) {
    const definition = phase18ActionCatalog.find((entry) => entry.id === actionId)!;
    const availability = canApplyAuthoritativeSystemAction(state, actionId, parameters);
    return (
      <button
        key={`${actionId}-${JSON.stringify(parameters)}`}
        type="button"
        className="phase18-transaction-button"
        disabled={transactionBusy || !availability.allowed}
        title={availability.reason}
        onClick={() => void onCommitAction({ actionId, approach, parameters })}
      >
        <strong>{label ?? definition.title}</strong>
        <small>{availability.allowed ? `${definition.classification} · ${definition.sourceIds.join(" / ")}` : availability.reason}</small>
      </button>
    );
  }

  function transactionHeader() {
    return (
      <div className="phase18-transaction-header">
        <div>
          <span>PHASE 18 · AUTHORITATIVE TRANSACTION</span>
          <strong>事务提交会推进时间、增加状态版本并建立存档点。</strong>
        </div>
        <label>
          后果取向
          <select value={approach} onChange={(event) => setApproach(event.target.value as SystemApproach)}>
            <option value="prudent">谨守</option>
            <option value="opportunity">转机</option>
            <option value="cost">代价</option>
            <option value="disorder">失序</option>
            <option value="aftermath">余波</option>
          </select>
        </label>
        <p role="status" aria-live="polite">{transactionBusy ? "正在提交数据库事务…" : transactionMessage}</p>
      </div>
    );
  }

  function renderTab() {
    if (activeTab === "strata") {
      return (
        <div className="phase17-strata-grid">
          {phase17Strata.map((stratum) => (
            <article key={stratum.id} className={stratum.id === currentStratum.id ? "current" : ""}>
              <span>LEVEL {stratum.level} · {stratum.classification}</span>
              <h3>{stratum.label}</h3>
              <p>{stratum.gameMeaning}</p>
              <dl>
                <div><dt>可进入</dt><dd>{stratum.access.join("、")}</dd></div>
                <div><dt>明确排除</dt><dd>{stratum.exclusions.join("；")}</dd></div>
                <div><dt>来源</dt><dd>{stratum.sourceIds.join(" / ")}</dd></div>
              </dl>
              {stratum.id === currentStratum.id && <strong className="phase17-current-mark">当前权限层</strong>}
            </article>
          ))}
          <BoundaryNote>七层是权限与学习曲线，不是唐代法定“七阶级”。只有编辑事件完成对应任务后，才可提升权限。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "changan") {
      return (
        <div className="phase17-map-layout">
          <section>
            <div className="phase17-ward-grid" role="grid" aria-label="长安一百零八坊玩法索引与东西市">
              {phase17ChanganCells.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  role="gridcell"
                  className={`${cell.kind} ${selectedCell === cell.id ? "selected" : ""}`}
                  aria-selected={selectedCell === cell.id}
                  title={cell.label}
                  onClick={() => setSelectedCell(cell.id)}
                >
                  {cell.kind === "market" ? cell.label : String(phase17Wards.find((ward) => ward.id === cell.id)?.conventionalIndex ?? "")}
                </button>
              ))}
            </div>
          </section>
          <aside className="phase17-map-dossier">
            <span>{selectedWardCell.kind === "market" ? "MARKET" : `WARD ${String(selectedWard?.conventionalIndex ?? 0).padStart(3, "0")}`}</span>
            <h3>{selectedWardCell.label}</h3>
            {selectedWard ? (
              <>
                <p>{selectedWard.county} · 第 {selectedWard.row} 行 / 第 {selectedWard.column} 列</p>
                <dl>
                  <div><dt>证据状态</dt><dd>仅索引；坊名与格位均待逐项核验</dd></div>
                  <div><dt>分类</dt><dd>{selectedWard.classification}</dd></div>
                  <div><dt>来源</dt><dd>{selectedWard.sourceIds.join(" / ")}</dd></div>
                </dl>
                <small>{selectedWard.uncertaintyNote}</small>
              </>
            ) : (
              <p>东西市作为坊外市场入口单列。其格位是玩法示意，不是测绘坐标。</p>
            )}
          </aside>
          <BoundaryNote>“108 坊”保留为传统玩法口径。研究中也存在 109 或 110 的计数。此图是 110 格交互索引，其中 108 格为坊、2 格为东西市；它不是考古测绘图，也没有擅自把候选坊名绑定到格位。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "realm") {
      return (
        <div className="phase17-realm-layout">
          {transactionHeader()}
          <section className="phase17-realm-map" aria-label="天宝元年十五道示意图">
            <div aria-hidden="true" className="phase17-river-mark">天下监察示意 · 非 GIS</div>
            {phase17Circuits.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === selectedCircuit ? "selected" : ""}
                style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
                onClick={() => setSelectedCircuit(entry.id)}
              >{entry.name}</button>
            ))}
          </section>
          <aside className="phase17-map-dossier">
            <span>CIRCUIT · {circuit.classification}</span>
            <h3>{circuit.name}</h3>
            <p>{circuit.focus}</p>
            <small>来源：{circuit.sourceIds.join(" / ")}。道是监察与地理组织口径，不等同现代省份。</small>
          </aside>
          <section className="phase18-transaction-grid" aria-label="高门网络与全国治理事务">
            {authorityButton("elite-introduction")}
            {authorityButton("elite-council")}
            {authorityButton("governance-accession")}
            {authorityButton("governance-revenue")}
            {authorityButton("governance-relief", { circuitId: circuit.id }, `赈济复核 · ${circuit.name}`)}
          </section>
          <BoundaryNote>742 年全国层采用开元十五道，不采用贞观十道。当前坐标只服务检索与导航，不承诺边界、距离或面积准确。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "court") {
      return (
        <div className="phase17-system-layout">
          {transactionHeader()}
          <section className="phase17-institution-grid">
            {phase17CourtInstitutions.map(([name, remit]) => <article key={name}><span>机构</span><strong>{name}</strong><small>{remit}</small></article>)}
          </section>
          <section>
            <h3>可起草公务</h3>
            <ActionRegister state={state} domain="court" onDraftAction={onDraftAction} />
          </section>
          <section className="phase18-transaction-grid" aria-label="案卷与官职权威事务">
            {authorityButton("study-records")}
            {authorityButton("case-open")}
            {authorityButton("case-investigate")}
            {authorityButton("case-resolve")}
            {authorityButton("office-appoint")}
            {authorityButton("office-duty")}
          </section>
          <BoundaryNote>机构卡只说明职责入口。官品、任免与财政结果必须由编辑事件、规则校验和数据库事务产生。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "palace") {
      return (
        <div className="phase17-system-layout">
          <section className="phase17-palace-ranks">
            {phase17PalaceRanks.map((rank) => <article key={`${rank.group}-${rank.title}`}><span>{rank.group} · 定额 {rank.count}</span><strong>{rank.title}</strong><small>{rank.note}</small></article>)}
          </section>
          <section>
            <h3>内廷治理草案</h3>
            <ActionRegister state={state} domain="palace" onDraftAction={onDraftAction} />
          </section>
          <BoundaryNote>内廷以供给、医疗、礼仪、申诉和人事程序为核心。本站不采用“宠幸数值”或露骨性内容；所有角色均受 16+ 克制写实边界保护。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "family") {
      return (
        <div className="phase17-system-layout">
          {transactionHeader()}
          <section className="phase17-family-rules">
            {phase17FamilyRules.map((entry) => <article key={entry.id}><span>{entry.layer}</span><strong>{entry.label}</strong><p>{entry.rule}</p></article>)}
          </section>
          <section>
            <h3>家户行动草案</h3>
            <ActionRegister state={state} domain="family" onDraftAction={onDraftAction} />
          </section>
          <section className="phase18-family-forms" aria-label="家户关系权威事务">
            <fieldset>
              <legend>玩家年龄确认</legend>
              <label>年龄<input type="number" min="18" max="80" value={actorAge} onChange={(event) => setActorAge(Number(event.target.value))} /></label>
              {authorityButton("confirm-adult-age", { actorAge })}
              {authorityButton("household-care")}
            </fieldset>
            <fieldset>
              <legend>成年婚约</legend>
              <label>对象称谓<input value={partnerLabel} maxLength={40} onChange={(event) => setPartnerLabel(event.target.value)} /></label>
              <label>对象年龄<input type="number" min="18" max="80" value={partnerAge} onChange={(event) => setPartnerAge(Number(event.target.value))} /></label>
              <label><input type="checkbox" checked={mutualConsent} onChange={(event) => setMutualConsent(event.target.checked)} />双方已明确同意</label>
              {authorityButton("marriage-contract", {
                partnerLabel: partnerLabel || undefined,
                partnerAge,
                mutualConsent: mutualConsent ? true : undefined,
              })}
            </fieldset>
            <fieldset>
              <legend>子女照护记录</legend>
              <label>称谓<input value={childLabel} maxLength={40} onChange={(event) => setChildLabel(event.target.value)} /></label>
              <label>年龄<input type="number" min="0" max="17" value={childAge} onChange={(event) => setChildAge(Number(event.target.value))} /></label>
              {authorityButton("register-child-care", { childLabel: childLabel || undefined, childAge })}
            </fieldset>
          </section>
          <BoundaryNote>婚姻、子女与照护现在写入权威 WorldState。所有身份均为叙事虚构；事务要求成年与明确同意，不记录生育能力评分，也不把子女数量作为胜负指标。</BoundaryNote>
        </div>
      );
    }

    if (activeTab === "items") {
      return (
        <div className="phase17-catalogue-layout">
          {transactionHeader()}
          <div className="phase17-filterbar">
            <label>检索物品<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称或编号" /></label>
            <label>分类<select value={itemCategory} onChange={(event) => setItemCategory(event.target.value)}>{itemCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <strong>{visibleItems.length} / {phase17ItemCatalog.length}</strong>
          </div>
          <div className="phase18-selected-item" role="region" aria-label="选中物品交易">
            <span>选中：{phase17ItemCatalog.find((item) => item.id === selectedItemId)?.name ?? "未选择"}</span>
            {authorityButton("trade-buy", { itemId: selectedItemId })}
            {authorityButton("trade-sell", { itemId: selectedItemId })}
            {authorityButton("workshop-production")}
          </div>
          <div className="phase17-item-grid">
            {visibleItems.map((item) => (
              <article key={item.id} className={item.id === selectedItemId ? "selected" : ""}>
                <span>{item.category} · {item.rarity} · {item.id}</span>
                <strong>{item.name}</strong>
                <p>账面参考 {item.ledgerValue} 文</p>
                <small>{item.classification} · {item.publicationStatus} · {item.sourceIds.join(" / ")}</small>
                <button type="button" aria-pressed={item.id === selectedItemId} onClick={() => setSelectedItemId(item.id)}>选择交易</button>
              </article>
            ))}
          </div>
          <BoundaryNote>这是 40 个基底 × 5 种状态形成的 200 项玩法目录，不是 200 种独立历史器物，也不是角色背包。价格仅为游戏记账值。</BoundaryNote>
        </div>
      );
    }

    return (
      <div className="phase17-catalogue-layout">
        {transactionHeader()}
        <div className="phase17-filterbar">
          <label>检索结局<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题或摘要" /></label>
          <label>结局组<select value={endingGroup} onChange={(event) => setEndingGroup(event.target.value)}>{endingGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
          <strong>{visibleEndings.length} / {phase17Endings.length}</strong>
        </div>
        <div className="phase18-selected-item">
          {authorityButton("prepare-departure")}
          <span>每个结局还要求对应的家户、交易、案卷、官职、高门或治理链，以及至少两次同一后果取向。</span>
        </div>
        <div className="phase17-ending-grid">
          {visibleEndings.map((ending) => {
            const required = phase17Strata.find((stratum) => stratum.id === ending.minimumStratum)!;
            const eligibility = getPhase18EndingEligibility(state, ending.id);
            return (
              <article key={ending.id} className={eligibility.eligible ? "reachable" : ""}>
                <span>{ending.id} · {ending.classification}</span>
                <strong>{ending.title}</strong>
                <p>{ending.summary}</p>
                <small>权限参考：{required.label} · {ending.publicationStatus}</small>
                {authorityButton("conclude-chapter", { endingId: ending.id }, eligibility.eligible ? "封存该结局" : eligibility.reason)}
              </article>
            );
          })}
        </div>
        <BoundaryNote>50 个结局均有可执行的规则路径和自动可达性证明。单个玩家仍须满足对应事件链并完成数据库事务，不能从目录直接领取结局。</BoundaryNote>
      </div>
    );
  }

  return (
    <section
      ref={panelRef}
      className="phase17-world-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase17-world-title"
      aria-describedby="phase17-world-description"
      onKeyDown={handleDialogKeyDown}
    >
      <header>
        <div>
          <span className="eyebrow">ARCHIVE / 17 · WORLD & SYSTEMS</span>
          <h2 id="phase17-world-title">天下与制度工作台</h2>
          <p id="phase17-world-description">七层权限、108 坊索引、十五道、朝政、内廷、家户、200 项物品目录与 50 个结局定义。</p>
        </div>
        <div className="phase17-scale" aria-label="系统规模">
          <span>{phase17Scale.strata}<small>阶层</small></span>
          <span>{phase17Scale.wards}<small>坊索引</small></span>
          <span>{phase17Scale.circuits}<small>道</small></span>
          <span>{phase17Scale.items}<small>物品</small></span>
          <span>{phase17Scale.endings}<small>结局</small></span>
        </div>
        <button type="button" onClick={onClose}>关闭</button>
      </header>
      <nav className="phase17-tabs" aria-label="天下与制度模块">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={activeTab === id ? "active" : ""} aria-pressed={activeTab === id} onClick={() => { setActiveTab(id); setQuery(""); }}>{label}</button>
        ))}
      </nav>
      <div className="phase17-world-body">{renderTab()}</div>
    </section>
  );
}
