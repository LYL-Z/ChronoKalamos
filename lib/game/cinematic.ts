export type CinematicOrigin = "merchant" | "craft" | "clerk";

export type PublishedCinematicScene = {
  eventId: string;
  originId: CinematicOrigin;
  shot: "threshold" | "tabletop" | "corridor";
  titleCard: string;
  atmosphere: string;
  motionCue: string;
  soundscape: string;
  voiceLine: {
    speaker: string;
    role: string;
    text: string;
    classification: "叙事虚构";
    language: "zh-CN";
  };
};

const publishedScenes = [
  {
    eventId: "merchant-ledger-mark",
    originId: "merchant",
    shot: "threshold",
    titleCard: "纸面留下了一个口子",
    atmosphere: "斜光越过门槛，账纸边缘轻轻起伏。远处的人声没有一句足够清楚。",
    motionCue: "账纸、尘光与远处人影分成三层缓慢移动。",
    soundscape: "纸张摩擦、木筹轻碰、被墙面削弱的市声。",
    voiceLine: {
      speaker: "康穆延",
      role: "家庭管事",
      text: "先别替这个印记说话。把我们真正看见的，一项一项留下。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "merchant-gate-window",
    originId: "merchant",
    shot: "corridor",
    titleCard: "时间比解释更快",
    atmosphere: "门影向内收窄。交割窗口没有形体，只通过越来越短的光带显现。",
    motionCue: "长影缓慢越过画面，朱砂刻度向前推进。",
    soundscape: "脚步、木门回声与远处间歇出现的车轴声。",
    voiceLine: {
      speaker: "康阿塔",
      role: "家中长辈",
      text: "赶得上，不等于说得清。你要决定，哪一种损失还能被解释。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "merchant-settlement",
    originId: "merchant",
    shot: "tabletop",
    titleCard: "账面会合拢，责任不会",
    atmosphere: "黄铜镇纸压住账页。最后一行仍留有一段没有被墨色填满的空白。",
    motionCue: "镜头从镇纸缓慢移向空白处，其他层保持静止。",
    soundscape: "笔尖停顿、呼吸与逐渐远去的市场背景声。",
    voiceLine: {
      speaker: "康穆延",
      role: "家庭管事",
      text: "若你不知道，就把不知道写进去。空白也可以是一种证据。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "craft-material-shortfall",
    originId: "craft",
    shot: "tabletop",
    titleCard: "缺口先出现在材料上",
    atmosphere: "木尺横在材料边缘。砂尘覆盖了重复丈量留下的浅痕。",
    motionCue: "一道冷光沿量具移动，细尘缓慢下落。",
    soundscape: "木料轻响、粗布摩擦与被压低的工坊谈话。",
    voiceLine: {
      speaker: "何九成",
      role: "师长",
      text: "缺多少不是最难的。最难的是，你准备用什么说服别人相信这个数。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "craft-mentor-pressure",
    originId: "craft",
    shot: "threshold",
    titleCard: "答案必须在工期之前出现",
    atmosphere: "师长站在光外。未完成的器物只露出轮廓，不给出可轻易判断的好坏。",
    motionCue: "前景保持清晰，背景轮廓随呼吸般轻微收放。",
    soundscape: "短促敲击、火声余响与一段刻意保留的安静。",
    voiceLine: {
      speaker: "何九成",
      role: "师长",
      text: "别给我一个快答案。给我一个出了问题之后，还能追问下去的答案。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "craft-delivery",
    originId: "craft",
    shot: "corridor",
    titleCard: "第一件作品离开了手",
    atmosphere: "包裹越过门槛。工坊仍在身后，交付记录却将在另一个地方被阅读。",
    motionCue: "画面中心的包裹向光处移动，工坊层逐渐失焦。",
    soundscape: "布结收紧、木门开启与脚步离开地面的轻响。",
    voiceLine: {
      speaker: "赵小七",
      role: "同辈学徒",
      text: "它一离开这里，别人只看得见成品。你要不要让他们也看见我们改过什么？",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "clerk-ambiguous-place",
    originId: "clerk",
    shot: "tabletop",
    titleCard: "一个地名分成两条路",
    atmosphere: "誊清件与草案并排铺开。靛蓝阴影恰好落在两个不同写法之间。",
    motionCue: "焦点在两处地名之间缓慢切换，边缘保持模糊。",
    soundscape: "纸页翻动、笔管触案与远处低沉的报时声。",
    voiceLine: {
      speaker: "韩砚生",
      role: "抄写吏",
      text: "字都认得，路却可能完全不同。先把分歧留下，别急着替它选一个。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "clerk-delivery-range",
    originId: "clerk",
    shot: "corridor",
    titleCard: "递送范围尚未合拢",
    atmosphere: "廊道把空间切成连续门框。每一道门都像一项尚未确认的责任边界。",
    motionCue: "门框层次缓慢向后退，当前路径用低饱和朱砂线标示。",
    soundscape: "压低的交谈、远近交替的脚步与纸封摩擦。",
    voiceLine: {
      speaker: "郭五郎",
      role: "递送人",
      text: "我能把它送到。可你得先告诉我，送到哪里才算没有越过这张纸。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
  {
    eventId: "clerk-register",
    originId: "clerk",
    shot: "tabletop",
    titleCard: "疑点要不要进入最后一行",
    atmosphere: "登记簿停在收束之前。黄铜光落在一处极窄的余白上。",
    motionCue: "余白逐渐亮起，周围文字只保留不可辨认的墨迹节奏。",
    soundscape: "笔锋吸墨、衣袖擦过案面与很远的门轴声。",
    voiceLine: {
      speaker: "卢省言",
      role: "承办者",
      text: "写进去，后人会追问。抹掉它，后人只会以为从来没有疑点。",
      classification: "叙事虚构",
      language: "zh-CN",
    },
  },
] satisfies PublishedCinematicScene[];

const sceneIndex = new Map(publishedScenes.map((scene) => [scene.eventId, scene]));

export function getPublishedCinematicScene(eventId: string): PublishedCinematicScene | null {
  return sceneIndex.get(eventId) ?? null;
}

export const publishedCinematicScenes = Object.freeze(publishedScenes);
