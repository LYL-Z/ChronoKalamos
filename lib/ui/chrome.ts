export type ChromeLocale = "zh" | "en" | "fr" | "el" | "ru";
export type ChromeNavId = "home" | "saves" | "settings" | "support" | "playtest";

const navZh: Record<ChromeNavId, string> = {
  home: "新开始",
  saves: "历史存档",
  settings: "个人设置",
  support: "支持说明",
  playtest: "公开测试",
};

const navByLocale: Record<ChromeLocale, Record<ChromeNavId, string>> = {
  zh: navZh,
  en: {
    home: "Begin",
    saves: "Archives",
    settings: "Settings",
    support: "Support",
    playtest: "Playtest",
  },
  fr: {
    home: "Commencer",
    saves: "Archives",
    settings: "Réglages",
    support: "Assistance",
    playtest: "Test public",
  },
  el: {
    home: "Νέα αρχή",
    saves: "Αρχεία",
    settings: "Ρυθμίσεις",
    support: "Υποστήριξη",
    playtest: "Δοκιμή",
  },
  ru: {
    home: "Начать",
    saves: "Архивы",
    settings: "Настройки",
    support: "Поддержка",
    playtest: "Тест",
  },
};

const skipByLocale: Record<ChromeLocale, string> = {
  zh: "跳到主要内容",
  en: "Skip to main content",
  fr: "Aller au contenu principal",
  el: "Μετάβαση στο κύριο περιεχόμενο",
  ru: "К основному содержанию",
};

export function getChromeCopy(locale: ChromeLocale) {
  const nav = navByLocale[locale];
  return {
    locale,
    nav,
    navZh,
    primaryNav: (id: ChromeNavId) => nav[id],
    secondaryNav: (id: ChromeNavId) => (locale === "zh" ? navByLocale.en[id] : navZh[id]),
    skip: skipByLocale[locale],
    findTitle: locale === "zh" ? "查找页面" : locale === "en" ? "Find a page" : locale === "fr" ? "Rechercher une page" : locale === "el" ? "Εύρεση σελίδας" : "Найти страницу",
    findLabel: locale === "zh" ? "检索" : locale === "en" ? "Search" : locale === "fr" ? "Recherche" : locale === "el" ? "Αναζήτηση" : "Поиск",
    findPlaceholder: locale === "zh"
      ? "新开始、存档、设置、支持、测试"
      : "Begin, archives, settings, support, playtest",
    findEmpty: locale === "zh" ? "没有匹配的页面。试一下“存档”或“支持”。" : "No matching page. Try “archives” or “support”.",
    findHint: locale === "zh" ? "开关 · Esc 关闭" : "toggle · Esc to close",
    findList: locale === "zh" ? "可前往的页面" : "Pages you can open",
    findButton: locale === "zh" ? "查找" : "Find",
    helpTitle: locale === "zh" ? "键位说明" : locale === "en" ? "Keyboard" : locale === "fr" ? "Raccourcis" : locale === "el" ? "Πλήκτρα" : "Клавиши",
    helpClose: locale === "zh" ? "关闭键位说明" : "Close keyboard help",
    helpSite: locale === "zh" ? "全站" : "Site",
    helpGame: locale === "zh" ? "游戏内" : "In play",
    helpFind: locale === "zh" ? "查找页面" : "Find a page",
    helpOpenClose: locale === "zh" ? "打开或关闭本说明" : "Open or close this help",
    helpEscape: locale === "zh" ? "关闭浮层" : "Close overlays",
    helpSkip: locale === "zh" ? "跳过链接可将焦点移到主内容。" : "The skip link moves focus to the main content.",
    helpTyping: locale === "zh" ? "输入框、按钮和对话框内，单键快捷键不会触发。" : "Single-key shortcuts do not fire inside inputs, buttons, or dialogs.",
    helpFocusChoices: locale === "zh" ? "聚焦选项，不自动提交" : "Focus a choice, do not submit",
    helpFocusAction: locale === "zh" ? "聚焦行动，不自动提交" : "Focus the action docket, do not submit",
    lowMotion: locale === "zh" ? "低动态" : locale === "en" ? "Low motion" : locale === "fr" ? "Mouvement réduit" : locale === "el" ? "Ήπια κίνηση" : "Меньше движения",
    restoreMotion: locale === "zh" ? "恢复动态" : locale === "en" ? "Restore motion" : locale === "fr" ? "Rétablir le mouvement" : locale === "el" ? "Επαναφορά κίνησης" : "Вернуть движение",
    method: locale === "zh"
      ? "每段内容都标明：史料记载、合理重建或叙事虚构。"
      : locale === "en"
        ? "Each passage is marked as record, reconstruction, or fiction."
        : locale === "fr"
          ? "Chaque passage indique : source, reconstruction ou fiction."
          : locale === "el"
            ? "Κάθε απόσπασμα σημειώνεται ως πηγή, ανακατασκευή ή μυθοπλασία."
            : "Каждый фрагмент отмечен как источник, реконструкция или вымысел.",
    languageNote: locale === "zh"
      ? "中文内容已完成内部校验；Phase 11 外部历史学家认证待定。其他语言仅翻译界面骨架。"
      : locale === "en"
        ? "Chinese content has passed internal checks; external historian certification for Phase 11 is pending. Other languages translate interface chrome only."
        : locale === "fr"
          ? "Le contenu chinois a passé les contrôles internes ; la certification historique externe de la phase 11 reste en attente. Les autres langues ne traduisent que l’interface."
          : locale === "el"
            ? "Το κινεζικό περιεχόμενο πέρασε εσωτερικό έλεγχο· η εξωτερική ιστορική πιστοποίηση της Φάσης 11 εκκρεμεί. Οι άλλες γλώσσες καλύπτουν μόνο το περιβάλλον."
            : "Китайский контент прошёл внутреннюю проверку; внешняя историческая сертификация Phase 11 ожидается. Другие языки пока переводят только интерфейс.",
    offlineTitle: locale === "zh" ? "当前离线" : locale === "en" ? "You are offline" : locale === "fr" ? "Hors ligne" : locale === "el" ? "Εκτός σύνδεσης" : "Нет сети",
    offlineBody: locale === "zh"
      ? "页面偏好仍可使用，但身份、存档与回合不会提交。恢复网络后请重试。"
      : "Preferences still work. Identity, saves, and turns will not submit until the network returns.",
    brandHome: locale === "zh" ? "ChronoKalamos 首页" : "ChronoKalamos home",
    paletteDetail: {
      home: locale === "zh" ? "地图、出身与身份入口" : "Map, origins, and the identity gate",
      saves: locale === "zh" ? "只显示当前身份可见的会话" : "Sessions visible to the current identity",
      settings: locale === "zh" ? "动态、字号、语言与阅读密度" : "Motion, type size, language, and density",
      support: locale === "zh" ? "失败恢复、史料方法与诊断" : "Recovery, evidence method, and diagnostics",
      playtest: locale === "zh" ? "自愿同意与最小数据采集" : "Voluntary consent and bounded telemetry",
    } satisfies Record<ChromeNavId, string>,
  };
}

export const paletteKeywords: Record<ChromeNavId, string> = {
  home: "home begin 开始 地图 新开始",
  saves: "archives saves 存档 历史存档",
  settings: "settings 设置 语言 个人设置",
  support: "support 支持 健康 支持说明",
  playtest: "playtest 测试 公开测试",
};
