"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IdentityPanel } from "@/components/identity-panel";

type Locale = "zh" | "en" | "fr" | "el" | "ru";

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "el", label: "Ελληνικά" },
  { value: "ru", label: "Русский" },
];

const uiCopy: Record<Locale, {
  nav: Record<(typeof navItems)[number]["id"], string>;
  lowMotion: string;
  restoreMotion: string;
  method: string;
  mapLayer: string;
  mapNote: string;
  languageNote: string;
  loaded: (title: string) => string;
}> = {
  zh: {
    nav: { new: "新开始", saves: "历史存档", settings: "个人设置", support: "支持说明" },
    lowMotion: "低动态",
    restoreMotion: "恢复动态",
    method: "每段内容都标明：史料记载、合理重建或叙事虚构。",
    mapLayer: "HISTORICAL MAP LAYER",
    mapNote: "这是首发内容包的原型图层。地理形状尚不等同于精确复原，发布前需补充来源、时间范围和许可信息。",
    languageNote: "中文史实内容已审校；其他语言仅翻译界面骨架。",
    loaded: (title) => `已载入 ${title}。第一回合尚未提交。`,
  },
  en: {
    nav: { new: "Begin", saves: "Archives", settings: "Settings", support: "Support" },
    lowMotion: "Low motion",
    restoreMotion: "Restore motion",
    method: "Each passage is marked as record, reconstruction, or fiction.",
    mapLayer: "HISTORICAL MAP LAYER",
    mapNote: "Prototype layer only. Geometry is not a verified reconstruction; sources, dates, and licenses remain required before release.",
    languageNote: "Chinese historical content is reviewed; other languages currently translate interface chrome only.",
    loaded: (title) => `${title} loaded. Turn one has not been submitted.`,
  },
  fr: {
    nav: { new: "Commencer", saves: "Archives", settings: "Réglages", support: "Assistance" },
    lowMotion: "Mouvement réduit",
    restoreMotion: "Rétablir le mouvement",
    method: "Chaque passage indique : source, reconstruction ou fiction.",
    mapLayer: "COUCHE CARTOGRAPHIQUE HISTORIQUE",
    mapNote: "Couche de prototype. La géométrie n'est pas une reconstitution vérifiée ; les sources, dates et licences restent requises.",
    languageNote: "Le contenu historique chinois est révisé ; les autres langues ne traduisent pour l'instant que l'interface.",
    loaded: (title) => `${title} chargé. Le premier tour n'est pas soumis.`,
  },
  el: {
    nav: { new: "Νέα αρχή", saves: "Αρχεία", settings: "Ρυθμίσεις", support: "Υποστήριξη" },
    lowMotion: "Ήπια κίνηση",
    restoreMotion: "Επαναφορά κίνησης",
    method: "Κάθε απόσπασμα σημειώνεται ως πηγή, ανακατασκευή ή μυθοπλασία.",
    mapLayer: "ΙΣΤΟΡΙΚΟ ΕΠΙΠΕΔΟ ΧΑΡΤΗ",
    mapNote: "Επίπεδο πρωτοτύπου. Η γεωμετρία δεν είναι επαληθευμένη ανακατασκευή· απαιτούνται πηγές, ημερομηνίες και άδειες.",
    languageNote: "Το κινεζικό ιστορικό περιεχόμενο έχει ελεγχθεί· οι άλλες γλώσσες μεταφράζουν προς το παρόν μόνο το περιβάλλον.",
    loaded: (title) => `Φορτώθηκε: ${title}. Ο πρώτος γύρος δεν υποβλήθηκε.`,
  },
  ru: {
    nav: { new: "Начать", saves: "Архивы", settings: "Настройки", support: "Поддержка" },
    lowMotion: "Меньше движения",
    restoreMotion: "Вернуть движение",
    method: "Каждый фрагмент отмечен как источник, реконструкция или вымысел.",
    mapLayer: "ИСТОРИЧЕСКИЙ СЛОЙ КАРТЫ",
    mapNote: "Это прототип. Геометрия не является проверенной реконструкцией; до публикации нужны источники, даты и лицензии.",
    languageNote: "Китайское историческое содержание проверено; другие языки пока переводят только элементы интерфейса.",
    loaded: (title) => `Загружено: ${title}. Первый ход ещё не отправлен.`,
  },
};

type Origin = {
  id: string;
  code: string;
  title: string;
  english: string;
  detail: string;
  source: string;
};

const origins: Origin[] = [
  {
    id: "merchant",
    code: "O-01",
    title: "西市粟特商户家庭后辈",
    english: "Sogdian merchant household",
    detail: "在西市的往来、账簿和多语交易中长大。",
    source: "合理重建 · S-014",
  },
  {
    id: "craft",
    code: "O-02",
    title: "长安工匠家庭学徒",
    english: "Chang’an craft apprentice",
    detail: "从家族作坊开始，观察材料、工序与行会秩序。",
    source: "合理重建 · S-021",
  },
  {
    id: "clerk",
    code: "O-03",
    title: "京兆基层吏员家庭成员",
    english: "Jingzhao clerical household",
    detail: "接触文书、里坊边界与基层行政的日常压力。",
    source: "合理重建 · S-031",
  },
];

const navItems = [
  { id: "new", label: "新开始", english: "Begin" },
  { id: "saves", label: "历史存档", english: "Archives" },
  { id: "settings", label: "个人设置", english: "Settings" },
  { id: "support", label: "支持说明", english: "Support" },
] as const;

const timeline = [
  { year: "738", note: "越过记载之前" },
  { year: "742", note: "你的第一天" },
  { year: "746", note: "尚未写下的四年" },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>ZW</span>
    </span>
  );
}

export default function Home() {
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>("new");
  const [selectedOrigin, setSelectedOrigin] = useState("merchant");
  const [showSetup, setShowSetup] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [language, setLanguage] = useState<Locale>(() => {
    if (typeof window === "undefined") return "zh";
    try {
      const stored = window.localStorage.getItem("chronokalamos-locale");
      return localeOptions.some((option) => option.value === stored) ? stored as Locale : "zh";
    } catch {
      return "zh";
    }
  });
  const [lowMotion, setLowMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("chronokalamos-low-motion") === "true";
    } catch {
      return false;
    }
  });
  const [message, setMessage] = useState("");
  const setupCloseButtonRef = useRef<HTMLButtonElement>(null);
  const copy = uiCopy[language];

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
      if (event.key === "Escape") setShowSetup(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [showSetup]);

  const selected = useMemo(
    () => origins.find((origin) => origin.id === selectedOrigin) ?? origins[0],
    [selectedOrigin],
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

  function startGame() {
    setShowSetup(false);
    setShowGame(true);
    setMessage(copy.loaded(selected.title));
  }

  function selectNav(id: (typeof navItems)[number]["id"]) {
    setActiveNav(id);
    if (id === "new") setShowSetup(true);
    if (id === "saves") setMessage("存档由 Supabase RLS 按用户隔离；游客凭证丢失后仍无法恢复。 ");
    if (id === "settings") setMessage("低动态模式与语言切换已在右上角开放；语言切换只改变界面骨架。 ");
    if (id === "support") setMessage("当前为前端原型：没有真实支付、短信、微信或QQ登录。 ");
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
    return (
      <main className={`game-shell ${lowMotion ? "low-motion" : ""}`}>
        <header className="masthead game-masthead">
          <div className="brand"><BrandMark /><span className="brand-copy"><strong>CHRONOKALAMOS</strong><small>史料边界 · A LIFE IN RECORD</small></span></div>
          <button className="text-button" type="button" onClick={() => setShowGame(false)}>返回档案入口</button>
        </header>
        <section className="game-grid" aria-label="742年长安游戏预览">
          <aside className="game-sidebar">
            <span className="eyebrow">TURN 00 · DRAFT</span>
            <h1>第一回合尚未落笔。</h1>
            <p>这是开发模拟器。AI、来源检索和事务提交会在阶段5接入。</p>
            <dl className="state-list">
              <div><dt>地点</dt><dd>长安 · 西市</dd></div>
              <div><dt>身份</dt><dd>{selected.title}</dd></div>
              <div><dt>时间</dt><dd>天宝元年 · 春</dd></div>
              <div><dt>史料状态</dt><dd><span className="status-dot" />合理重建</dd></div>
            </dl>
            <button className="primary-button" type="button" onClick={() => setMessage("开发模拟器尚未推进真实回合。 ")}>查看下一步</button>
          </aside>
          <article className="narrative-panel">
            <div className="panel-heading"><span className="eyebrow">SCENE 00 · WESTERN MARKET</span><span className="source-chip">S-014 · 已发布</span></div>
            <p className="narrative-lede">清晨的门声先于日光抵达。你还没有名字，只有一页被反复折叠的账纸。</p>
            <p>此处内容仅用于前端流程演示。它不会被标记为“史料记载”，也不会写入永久存档。</p>
            <div className="choice-list" aria-label="开发模拟选择">
              <button type="button" onClick={() => setMessage("选择已记录为本地模拟，不会提交状态。 ")}>先核对账纸上的印记</button>
              <button type="button" onClick={() => setMessage("选择已记录为本地模拟，不会提交状态。 ")}>跟随家人走向西市</button>
              <button type="button" onClick={() => setMessage("自由输入将在阶段5进入审核流程。 ")}>输入自己的行动</button>
            </div>
            {message && <p className="inline-message" role="status">{message}</p>}
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className={`site-frame ${lowMotion ? "low-motion" : ""}`}>
      <header className="masthead">
        <div className="brand"><BrandMark /><span className="brand-copy"><strong>CHRONOKALAMOS</strong><small>史料边界 · A LIFE IN RECORD</small></span></div>
        <nav className="mast-nav" aria-label="主导航">
          <span className="edition"><span className="status-dot" />PREVIEW 0.7.42</span>
          <label className="language-select"><span className="sr-only">选择语言</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Locale)}>{localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button className="text-button" type="button" aria-pressed={lowMotion} onClick={toggleLowMotion}>{lowMotion ? copy.restoreMotion : copy.lowMotion}</button>
        </nav>
      </header>

      <div className="site-layout">
        <aside className="side-nav" aria-label="账户与存档">
          <p className="side-kicker">ARCHIVE / 01</p>
          <div className="side-links">
            {navItems.map((item) => <button className={activeNav === item.id ? "side-link active" : "side-link"} key={item.id} type="button" onClick={() => selectNav(item.id)}><span>{copy.nav[item.id]}</span><small>{item.english}</small></button>)}
          </div>
          <div className="side-note"><span className="eyebrow">METHOD</span><p>{copy.method}</p></div>
        </aside>

        <section className="map-column" aria-labelledby="hero-title">
          <div className="map-stage">
            <div className="map-topline"><span className="eyebrow">{copy.mapLayer}</span><span className="map-scale">西安 / 742 · 1 : 12,000</span></div>
            <h1 id="hero-title" className="map-title">历史总是对我紧追不舍。<em>Chang’an, 742 CE · a bounded beginning</em></h1>
            <div className="map-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="district district-west"><strong>西市</strong><small>贸易与迁徙</small></div>
            <div className="district district-gate"><strong>金光门</strong><small>城门记录</small></div>
            <div className="district district-jingzhao"><strong>京兆府</strong><small>行政范围</small></div>
            <div className="map-node node-market"><span className="node-dot" /><span>WESTERN MARKET</span></div>
            <div className="map-node node-gate"><span className="node-dot" /><span>GATE / 03</span></div>
            <div className="map-node node-office"><span className="node-dot brass" /><span>JINGZHAO</span></div>
            <div className="map-legend"><span><i className="legend-line red" />水系与交通</span><span><i className="legend-line navy" />行政边界</span><span><i className="legend-line brass" />来源不确定性</span></div>
            <p className="map-caption"><strong>地图说明</strong><br />{copy.mapNote}</p>
            <span className="date-stamp">天宝元年<br />SPRING / 742</span>
          </div>
          <div className="timeline-rail" aria-label="历史时间轴">
            <span className="rail-kicker">TANG · CHANG’AN · ANNO</span><div className="timeline-line" aria-hidden="true" />
            {timeline.map((item) => <button className={`timeline-item ${item.year === "742" ? "current" : ""}`} key={item.year} type="button" onClick={() => setMessage(item.year === "742" ? "当前起点：天宝元年。" : "时间轴仅用于原型浏览，尚未改变世界状态。")}><span className="timeline-dot" /><strong>{item.year}</strong><small>{item.note}</small></button>)}
            <span className="rail-foot">THE MAP REMEMBERS WHAT WE CANNOT</span>
          </div>
        </section>

        <aside className="login-sheet" aria-label="游客入口">
          <span className="sheet-tab">IDENTITY BOUNDARY</span><p className="sheet-label">ARCHIVE GATE / 03</p><h2>先留下一个入口。</h2><p className="sheet-copy">游客与邮箱账户使用同一用户 ID 升级路径。数据库和私有文件均由 RLS 限定为本人可见。</p>
          <IdentityPanel originId={selectedOrigin} onGuestStarted={() => setShowSetup(true)} onMessage={setMessage} />
          <div className="in-prep"><span>阶段 3 / 7</span><span>身份与存档</span></div>
        </aside>
      </div>

      <section className="origin-deck" aria-labelledby="origins-title">
        <div className="origin-intro"><p className="eyebrow">FIRST RECORDED LIFE</p><h2 id="origins-title">三种出身，三个证据入口。</h2><p>先选择社会位置，再让故事获得边界。</p></div>
        {origins.map((origin) => <label className={`origin-card ${selectedOrigin === origin.id ? "selected" : ""}`} key={origin.id}><input type="radio" name="origin" value={origin.id} checked={selectedOrigin === origin.id} onChange={() => setSelectedOrigin(origin.id)} /><span className="origin-sigil" aria-hidden="true">{origin.code.slice(-1)}</span><span><span className="origin-code">{origin.code}</span><strong>{origin.title}</strong><small>{origin.english}</small><p>{origin.detail}</p><em>{origin.source}</em></span><span className="origin-arrow" aria-hidden="true">↗</span></label>)}
      </section>

      <footer className="status-bar"><span><strong>史料边界：</strong> 已发布 18 条 · 待核验 7 条 · 叙事虚构 3 条</span><span>{copy.languageNote} · 16+ · No real payments</span></footer>

      {showSetup && <div className="setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowSetup(false); }}><section className="setup-sheet" role="dialog" aria-modal="true" aria-labelledby="setup-title" aria-describedby="setup-description"><div className="setup-header"><div><p className="eyebrow">NEW SESSION / 742 CE</p><h2 id="setup-title">把时间落在一个人身上。</h2></div><button ref={setupCloseButtonRef} className="icon-button" type="button" aria-label="关闭设定" onClick={() => setShowSetup(false)}>×</button></div><p id="setup-description" className="setup-copy">这是有限自定义的首发模板。你可以调整姓名、性别和性格；时代、地点与社会边界不会被自由输入覆盖。</p><div className="setup-options">{origins.map((origin) => <button type="button" className={selectedOrigin === origin.id ? "setup-option selected" : "setup-option"} key={origin.id} aria-pressed={selectedOrigin === origin.id} onClick={() => setSelectedOrigin(origin.id)}><span>{origin.code}</span><strong>{origin.title}</strong><small>{origin.detail}</small></button>)}</div><div className="setup-footer"><span><strong>标签：</strong>合理重建 · 来源待展开</span><button className="primary-button" type="button" onClick={startGame}>确认并进入</button></div></section></div>}
      {message && !showSetup && <div className="toast" role="status">{message}<button className="icon-button" type="button" aria-label="关闭提示" onClick={() => setMessage("")}>×</button></div>}
    </main>
  );
}
