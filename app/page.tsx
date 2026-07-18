"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [language, setLanguage] = useState("中文");
  const [lowMotion, setLowMotion] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("chronokalamos-low-motion") === "true");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const next = Math.min(100, Math.round((elapsed / 1600) * 100));
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => setBooting(false), 160);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const selected = useMemo(
    () => origins.find((origin) => origin.id === selectedOrigin) ?? origins[0],
    [selectedOrigin],
  );

  function toggleLowMotion() {
    setLowMotion((current) => {
      const next = !current;
      window.localStorage.setItem("chronokalamos-low-motion", String(next));
      return next;
    });
  }

  function startGame() {
    setShowSetup(false);
    setShowGame(true);
    setMessage(`已载入 ${selected.title}。第一回合尚未提交。`);
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setMessage("请先输入邮箱，或使用游客模式继续。 ");
      return;
    }
    setMessage("邮箱入口已记录为开发模拟器，正式身份系统将在阶段3接入。 ");
  }

  function selectNav(id: (typeof navItems)[number]["id"]) {
    setActiveNav(id);
    if (id === "new") setShowSetup(true);
    if (id === "saves") setMessage("游客存档只保存在当前浏览器，清除数据后无法恢复。 ");
    if (id === "settings") setMessage("低动态模式与语言切换已在右上角开放。 ");
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
          <label className="language-select"><span className="sr-only">选择语言</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>中文</option><option>English</option><option>Français</option><option>Ελληνικά</option><option>Русский</option></select></label>
          <button className="text-button" type="button" onClick={toggleLowMotion}>{lowMotion ? "恢复动态" : "低动态"}</button>
        </nav>
      </header>

      <div className="site-layout">
        <aside className="side-nav" aria-label="账户与存档">
          <p className="side-kicker">ARCHIVE / 01</p>
          <div className="side-links">
            {navItems.map((item) => <button className={activeNav === item.id ? "side-link active" : "side-link"} key={item.id} type="button" onClick={() => selectNav(item.id)}><span>{item.label}</span><small>{item.english}</small></button>)}
          </div>
          <div className="side-note"><span className="eyebrow">METHOD</span><p>每段内容都标明：史料记载、合理重建或叙事虚构。</p></div>
        </aside>

        <section className="map-column" aria-labelledby="hero-title">
          <div className="map-stage">
            <div className="map-topline"><span className="eyebrow">HISTORICAL MAP LAYER</span><span className="map-scale">西安 / 742 · 1 : 12,000</span></div>
            <h1 id="hero-title" className="map-title">历史总是对我紧追不舍。<em>Chang’an, 742 CE · a bounded beginning</em></h1>
            <div className="map-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="district district-west"><strong>西市</strong><small>贸易与迁徙</small></div>
            <div className="district district-gate"><strong>金光门</strong><small>城门记录</small></div>
            <div className="district district-jingzhao"><strong>京兆府</strong><small>行政范围</small></div>
            <div className="map-node node-market"><span className="node-dot" /><span>WESTERN MARKET</span></div>
            <div className="map-node node-gate"><span className="node-dot" /><span>GATE / 03</span></div>
            <div className="map-node node-office"><span className="node-dot brass" /><span>JINGZHAO</span></div>
            <div className="map-legend"><span><i className="legend-line red" />水系与交通</span><span><i className="legend-line navy" />行政边界</span><span><i className="legend-line brass" />来源不确定性</span></div>
            <p className="map-caption"><strong>地图说明</strong><br />这是首发内容包的原型图层。地理形状尚不等同于精确复原，发布前需补充来源、时间范围和许可信息。</p>
            <span className="date-stamp">天宝元年<br />SPRING / 742</span>
          </div>
          <div className="timeline-rail" aria-label="历史时间轴">
            <span className="rail-kicker">TANG · CHANG’AN · ANNO</span><div className="timeline-line" aria-hidden="true" />
            {timeline.map((item) => <button className={`timeline-item ${item.year === "742" ? "current" : ""}`} key={item.year} type="button" onClick={() => setMessage(item.year === "742" ? "当前起点：天宝元年。" : "时间轴仅用于原型浏览，尚未改变世界状态。")}><span className="timeline-dot" /><strong>{item.year}</strong><small>{item.note}</small></button>)}
            <span className="rail-foot">THE MAP REMEMBERS WHAT WE CANNOT</span>
          </div>
        </section>

        <aside className="login-sheet" aria-label="游客入口">
          <span className="sheet-tab">VISITOR ACCESS</span><p className="sheet-label">ARCHIVE GATE / 00</p><h2>先留下一个入口。</h2><p className="sheet-copy">你可以先以游客身份开始。清除浏览器数据后，游客存档无法恢复。</p>
          <form className="login-form" onSubmit={submitEmail}><label htmlFor="email">邮箱入口</label><input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="primary-button" type="submit">记录邮箱</button></form>
          <div className="guest"><button className="link-button" type="button" onClick={() => setShowSetup(true)}>以游客开始 →</button><p>微信、QQ、手机号：筹备中，不显示伪登录。</p></div>
          <div className="in-prep"><span>阶段 1 / 7</span><span>前端原型</span></div>
        </aside>
      </div>

      <section className="origin-deck" aria-labelledby="origins-title">
        <div className="origin-intro"><p className="eyebrow">FIRST RECORDED LIFE</p><h2 id="origins-title">三种出身，三个证据入口。</h2><p>先选择社会位置，再让故事获得边界。</p></div>
        {origins.map((origin) => <label className={`origin-card ${selectedOrigin === origin.id ? "selected" : ""}`} key={origin.id}><input type="radio" name="origin" value={origin.id} checked={selectedOrigin === origin.id} onChange={() => setSelectedOrigin(origin.id)} /><span className="origin-sigil" aria-hidden="true">{origin.code.slice(-1)}</span><span><span className="origin-code">{origin.code}</span><strong>{origin.title}</strong><small>{origin.english}</small><p>{origin.detail}</p><em>{origin.source}</em></span><span className="origin-arrow" aria-hidden="true">↗</span></label>)}
      </section>

      <footer className="status-bar"><span><strong>史料边界：</strong> 已发布 18 条 · 待核验 7 条 · 叙事虚构 3 条</span><span>Content in Chinese and English · 16+ · No real payments</span></footer>

      {showSetup && <div className="setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowSetup(false); }}><section className="setup-sheet" role="dialog" aria-modal="true" aria-labelledby="setup-title"><div className="setup-header"><div><p className="eyebrow">NEW SESSION / 742 CE</p><h2 id="setup-title">把时间落在一个人身上。</h2></div><button className="icon-button" type="button" aria-label="关闭设定" onClick={() => setShowSetup(false)}>×</button></div><p className="setup-copy">这是有限自定义的首发模板。你可以调整姓名、性别和性格；时代、地点与社会边界不会被自由输入覆盖。</p><div className="setup-options">{origins.map((origin) => <button type="button" className={selectedOrigin === origin.id ? "setup-option selected" : "setup-option"} key={origin.id} onClick={() => setSelectedOrigin(origin.id)}><span>{origin.code}</span><strong>{origin.title}</strong><small>{origin.detail}</small></button>)}</div><div className="setup-footer"><span><strong>标签：</strong>合理重建 · 来源待展开</span><button className="primary-button" type="button" onClick={startGame}>确认并进入</button></div></section></div>}
      {message && !showSetup && <div className="toast" role="status">{message}<button className="icon-button" type="button" aria-label="关闭提示" onClick={() => setMessage("")}>×</button></div>}
    </main>
  );
}
