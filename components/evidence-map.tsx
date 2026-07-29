"use client";

import { useMemo, useState } from "react";
import { sourceLabel, sourceSummary, type HistoricalSource, type MapFeature } from "@/lib/historical/content";

type EvidenceMapProps = {
  features: MapFeature[];
  sources: HistoricalSource[];
  contentSource: "syncing" | "database" | "fallback";
  contentError?: string;
  currentEventId: string | null;
  onRetry: () => void;
};

const eventFeatureMap: Record<string, string> = {
  "western-market": "M-001",
  "jin-guang-gate": "M-002",
  "jingzhao-fu": "M-003",
  "daming-palace": "M-004",
  "craft-ward": "M-005",
  "eastern-market": "M-006",
  "mingde-gate": "M-007",
  "imperial-city": "M-008",
};

export function featureIdForEvent(eventId: string | null): string | null {
  if (!eventId) return null;
  const prefix = eventId.split("-").slice(0, 2).join("-");
  if (eventId.startsWith("merchant-")) {
    if (eventId.includes("gate")) return eventFeatureMap["jin-guang-gate"];
    return eventFeatureMap["western-market"];
  }
  if (eventId.startsWith("craft-")) {
    if (eventId.includes("east") || eventId.includes("market")) return eventFeatureMap["eastern-market"];
    return eventFeatureMap["craft-ward"];
  }
  if (eventId.startsWith("clerk-")) {
    if (eventId.includes("imperial")) return eventFeatureMap["imperial-city"];
    return eventFeatureMap["jingzhao-fu"];
  }
  return eventFeatureMap[prefix] ?? null;
}

export function EvidenceMap({
  features,
  sources,
  contentSource,
  contentError,
  currentEventId,
  onRetry,
}: EvidenceMapProps) {
  const [year, setYear] = useState(742);
  const [sourceId, setSourceId] = useState("all");
  const [classification, setClassification] = useState("all");
  const [uncertainty, setUncertainty] = useState("all");
  const currentFeatureId = featureIdForEvent(currentEventId);

  const sourceOptions = useMemo(() => {
    const referenced = new Set(features.flatMap((feature) => feature.sourceIds));
    return sources.filter((source) => referenced.has(source.id));
  }, [features, sources]);

  const visibleFeatures = useMemo(() => features.filter((feature) => {
    if (year < feature.validFrom || year > feature.validTo) return false;
    if (sourceId !== "all" && !feature.sourceIds.includes(sourceId)) return false;
    if (classification !== "all" && feature.classification !== classification) return false;
    if (uncertainty !== "all" && feature.uncertaintyCode !== uncertainty) return false;
    return true;
  }), [classification, features, sourceId, uncertainty, year]);

  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(features[0]?.id ?? "");

  const selected = visibleFeatures.find((feature) => feature.id === selectedFeatureId)
    ?? visibleFeatures.find((feature) => feature.id === currentFeatureId)
    ?? visibleFeatures[0]
    ?? null;

  function resetFilters() {
    setYear(742);
    setSourceId("all");
    setClassification("all");
    setUncertainty("all");
  }

  return (
    <section className="evidence-map" aria-labelledby="hero-title">
      <header className="evidence-map-heading">
        <div>
          <span className="eyebrow">HISTORICAL EVIDENCE LAYER</span>
          <h1 id="hero-title">历史总是对我紧追不舍。</h1>
          <p>Chang’an, 742 CE · a bounded beginning</p>
        </div>
        <div className={`content-sync-flow ${contentSource}`} data-content-source={contentSource} role="status">
          <span className="status-dot" />
          {contentSource === "database"
            ? "SUPABASE / PUBLISHED MIRROR"
            : contentSource === "syncing"
              ? "SYNCING EVIDENCE PACKAGE"
              : "LOCAL VALIDATED FALLBACK"}
        </div>
      </header>

      {contentError && (
        <div className="inline-recovery" role="alert">
          <span><strong>证据镜像同步失败。</strong>{contentError}</span>
          <button className="secondary-button" type="button" onClick={onRetry}>重试同步</button>
        </div>
      )}

      <form className="map-filters" aria-label="证据图层筛选" onSubmit={(event) => event.preventDefault()}>
        <label>
          时间
          <input
            aria-label="证据年份"
            type="number"
            min={600}
            max={900}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </label>
        <label>
          来源
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            <option value="all">全部来源</option>
            {sourceOptions.map((source) => <option key={source.id} value={source.id}>{source.id} · {source.title}</option>)}
          </select>
        </label>
        <label>
          证据等级
          <select value={classification} onChange={(event) => setClassification(event.target.value)}>
            <option value="all">全部等级</option>
            <option value="史料记载">史料记载</option>
            <option value="合理重建">合理重建</option>
            <option value="叙事虚构">叙事虚构</option>
          </select>
        </label>
        <label>
          地理不确定性
          <select value={uncertainty} onChange={(event) => setUncertainty(event.target.value)}>
            <option value="all">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>
        <button className="text-button" type="button" onClick={resetFilters}>重置筛选</button>
      </form>

      <div className="evidence-workbench">
        <div className="evidence-canvas" aria-label={`${year} 年证据示意图，共 ${visibleFeatures.length} 个要素`}>
          <div className="map-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <span className="date-stamp">{year}<br />EVIDENCE VIEW</span>
          {visibleFeatures.map((feature) => (
            <button
              className={`map-node evidence-node ${selected?.id === feature.id ? "selected" : ""} ${currentFeatureId === feature.id ? "current-event" : ""}`}
              key={feature.id}
              type="button"
              aria-pressed={selected?.id === feature.id}
              aria-label={`${feature.nameZh}，${sourceLabel(feature.classification)}，不确定性${feature.uncertaintyCode}`}
              style={{ left: `${feature.schematicPosition.left}%`, top: `${feature.schematicPosition.top}%` }}
              onClick={() => setSelectedFeatureId(feature.id)}
            >
              <span className={`node-dot ${feature.kind === "administration" ? "brass" : ""}`} />
              <span>{feature.nameZh}</span>
              {currentFeatureId === feature.id && <small>当前事件</small>}
            </button>
          ))}
          {visibleFeatures.length === 0 && (
            <div className="map-empty" role="status">
              <strong>没有符合筛选条件的证据要素。</strong>
              <span>这不表示该年份没有历史活动，只表示当前已发布图层没有匹配记录。</span>
              <button className="secondary-button" type="button" onClick={resetFilters}>恢复 742 年全部图层</button>
            </div>
          )}
        </div>

        <aside className="evidence-detail" aria-live="polite">
          {selected ? (
            <>
              <div className="map-evidence-heading">
                <span className="source-chip">{sourceLabel(selected.classification)}</span>
                <strong>{selected.nameZh}</strong>
              </div>
              <p>{selected.uncertaintyNoteZh}</p>
              <dl>
                <div><dt>有效时间</dt><dd>{selected.validFrom}–{selected.validTo}</dd></div>
                <div><dt>时间精度</dt><dd>{selected.temporalPrecision}</dd></div>
                <div><dt>不确定性</dt><dd>{selected.uncertaintyCode}</dd></div>
                <div><dt>来源</dt><dd>{sourceSummary(selected.sourceIds)}</dd></div>
                <div><dt>状态</dt><dd>{selected.publicationStatus ?? (selected.published ? "published" : "provisional")}</dd></div>
                <div><dt>许可</dt><dd>{selected.licenseCode}</dd></div>
              </dl>
              <small>{selected.attribution}</small>
            </>
          ) : (
            <p>选择一个证据节点查看来源、时间和许可。</p>
          )}
        </aside>
      </div>
      <footer className="map-method-note">
        <strong>地图边界：</strong>
        几何为手绘证据示意，不是 742 年测绘边界。筛选结果只描述当前内容包，不可外推为完整的唐长安 GIS。
      </footer>
    </section>
  );
}
