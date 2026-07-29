import { z } from "zod";
import { phase11Content } from "@/lib/historical/phase11";
import { phase11CitationLinks } from "@/lib/historical/phase11-citations";

const originSchema = z.enum(["merchant", "craft", "clerk"]);
const boundedIdSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);

export const phase11CinematicSceneSchema = z.object({
  id: boundedIdSchema,
  eventId: boundedIdSchema,
  originId: originSchema,
  locationId: boundedIdSchema,
  titleCard: z.string().min(2).max(120),
  shot: z.enum(["threshold", "tabletop", "corridor", "close-detail"]),
  camera: z.string().min(12).max(180),
  light: z.string().min(12).max(180),
  motion: z.string().min(12).max(180),
  soundscape: z.array(z.string().min(2).max(80)).min(2).max(5),
  palette: z.tuple([z.literal("砂纸"), z.literal("朱砂"), z.literal("靛蓝"), z.literal("黄铜")]),
  dialogueLineId: boundedIdSchema,
  evidenceLinkIds: z.array(z.string().regex(/^cite-[a-z0-9-]+-s-\d{3}$/)).min(3).max(8),
  classification: z.literal("叙事虚构"),
  audioPolicy: z.object({
    autoplay: z.literal(false),
    captionsRequired: z.literal(true),
    syntheticVoice: z.literal("device-only"),
    historicalPronunciationClaim: z.literal(false),
  }).strict(),
  publicationStatus: z.literal("provisional"),
}).strict();

export type Phase11CinematicScene = z.infer<typeof phase11CinematicSceneSchema>;

const directionByOrigin = {
  merchant: {
    shots: ["threshold", "tabletop", "corridor", "close-detail"] as const,
    cameras: [
      "低机位越过门槛观察账纸与远处人影，人物不占据画面中心。",
      "俯角贴近账纸、木筹与货样，只保留一只手进入画面边缘。",
      "沿市门方向压缩纵深，让逐渐收窄的光带代替倒计时。",
      "靠近印记、布结或镇纸，背景人群只保留不可辨认的轮廓。",
    ],
    lights: [
      "暖色斜光切开靛蓝阴影，朱砂只出现在证据焦点与风险刻度。",
      "黄铜反光停在纸页边缘，人物面部不接受戏剧化追光。",
    ],
    sounds: ["纸张摩擦", "木筹轻碰", "远处市声", "车轴与脚步"],
  },
  craft: {
    shots: ["tabletop", "close-detail", "threshold", "corridor"] as const,
    cameras: [
      "镜头贴近量具与材料缺口，避免把作坊空间画成已证实的遗址复原。",
      "沿工具表面缓慢移动，以磨痕、粉尘和手势表现劳动强度。",
      "从未完成器物后方看向师徒，人物关系通过站位而非夸张表情表达。",
      "跟随交付物越过门槛，工坊逐渐失焦，记录页保持清晰。",
    ],
    lights: [
      "低饱和火色只照亮工作表面，四周由靛蓝和烟灰色压暗。",
      "冷光沿木尺或量具移动，黄铜色用于确认可复核的边缘。",
    ],
    sounds: ["木料轻响", "工具短促敲击", "布料摩擦", "火声余响"],
  },
  clerk: {
    shots: ["tabletop", "corridor", "close-detail", "threshold"] as const,
    cameras: [
      "俯视草案与誊清件之间的差异，文字保持不可辨识，避免伪造原始文书。",
      "用连续门框压缩廊道，当前递送路径只以细朱砂线标示。",
      "贴近缺失记号或窄小余白，责任边界通过空处而非官署奇观呈现。",
      "从案边看向承办者与递送人，面部退入阴影，纸页成为视觉重心。",
    ],
    lights: [
      "靛蓝阴影切开两份文书，黄铜光停在差异处，不制造神秘符号。",
      "窄窗光形成连续条带，朱砂只用于当前疑点与递送边界。",
    ],
    sounds: ["笔管触案", "纸页翻动", "廊道脚步", "远处报时声"],
  },
} as const;

function buildScene(event: (typeof phase11Content.events)[number]): Phase11CinematicScene {
  const voiceLine = phase11Content.voiceLines.find((line) => line.eventId === event.eventId);
  if (!voiceLine) throw new Error(`cinematic scene ${event.eventId} is missing a voice line`);
  const direction = directionByOrigin[event.originId];
  const index = (event.sequence - 1) % direction.shots.length;
  const evidenceLinkIds = phase11CitationLinks
    .filter((link) => link.eventId === event.eventId)
    .map((link) => link.id);

  return phase11CinematicSceneSchema.parse({
    id: `scene-${event.eventId}`,
    eventId: event.eventId,
    originId: event.originId,
    locationId: event.locationId,
    titleCard: event.title,
    shot: direction.shots[index],
    camera: direction.cameras[index],
    light: direction.lights[(event.sequence - 1) % direction.lights.length],
    motion: event.phase === "ending"
      ? "镜头逐渐停住，只让纸页边缘保留一次缓慢位移；低动态模式下完全静止。"
      : "前、中、后景以不同速度缓慢位移；没有闪烁，低动态模式下完全静止。",
    soundscape: direction.sounds,
    palette: ["砂纸", "朱砂", "靛蓝", "黄铜"],
    dialogueLineId: voiceLine.id,
    evidenceLinkIds,
    classification: "叙事虚构",
    audioPolicy: {
      autoplay: false,
      captionsRequired: true,
      syntheticVoice: "device-only",
      historicalPronunciationClaim: false,
    },
    publicationStatus: "provisional",
  });
}

export const phase11CinematicScenes = Object.freeze(phase11Content.events.map(buildScene));

if (phase11CinematicScenes.length !== 27) {
  throw new Error(`phase11 cinematic contract requires 27 scenes; found ${phase11CinematicScenes.length}`);
}

if (new Set(phase11CinematicScenes.map((scene) => scene.dialogueLineId)).size !== 27) {
  throw new Error("phase11 cinematic scenes must use one distinct dialogue line per event");
}
