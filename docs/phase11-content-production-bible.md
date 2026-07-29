# Phase 11 内容生产圣经

版本：11.0.0
日期：2026-07-29
适用范围：742年长安、27个公开测试事件、12名命名NPC、8个证据地点
公开状态：`public-beta-unreviewed`；历史条目为 `provisional`
权威状态所有者：服务端规则引擎与Supabase事务

## 1. 目的

本规范把玩法、叙事、美术、动画、音频和历史审校放进同一生产合同。它服务于当前Web游戏，也为未来Unity表现层保留中立数据接口。

本规范不改变以下边界：

- `docs/narrative-contract.md` 决定模型权限。
- `docs/consequence-system.md` 决定状态提交。
- DeepSeek只改写受限叙事表达。
- AI不能新增人物、地点、物品、状态或结局。
- 画面、动画和声音只能表现已提交或正在候选展示的状态。
- 外部学者签字前，Phase 11只能进入带持续提示的 `public-beta-unreviewed` 运行时，不得宣称历史认证。

## 2. 必须纠正的六项前提

### 2.1 三个社会维度不是三个任意加减的隐藏数值

“身份阶层、社会声望、阵营立场”必须是权威状态的确定性投影。不得另外维护一套客户端数值。

| 投影 | 权威输入 | 允许变化 | 禁止做法 |
|---|---|---|---|
| 身份准入 `accessBand` | `socialIdentity`、`occupation`、事件旗标、地点规则 | 由职业或明确事件改变 | 每个普通对话都升降阶层 |
| 社会声望 `prestigeBand` | `reputation.household/market/administration` | 由编辑后果改变 | 画面或模型直接写分数 |
| 阵营立场 `factionPosture` | NPC关系、关系记忆、已完成事件 | 由可追溯选择改变 | 用一句台词任意翻转立场 |

每个选择必须声明三个维度的影响。没有因果依据时，必须写 `no_change` 和理由。强迫每个选择同时改变三个维度会制造噪声，也会破坏角色逻辑。

### 2.2 压力不能只靠光影和声音表达

光线、人流和音乐可以承担沉浸表达，但必须保留可读文本：

- `晨市方开`
- `市声渐盛`
- `日影西移`
- `坊门将闭`
- `夜禁已近`

屏幕阅读器必须读到阶段名称和风险状态。低动态模式必须关闭非必要移动。静音玩家不得失去时间信息。

### 2.3 不伪造“长安本土俚语”

现有证据不足以稳定复原742年长安口语。台词采用现代可读中文，并以文体、身份和句法密度区分人物。

- 官署人物：短句、条件、责任边界和书面词汇。
- 商户人物：数量、见证、信用、时限和交易对象。
- 工匠人物：材料、工序、误差、返工和署名。
- 家庭人物：关系、风险、名声和生活压力。

不得编造方言口音。不得用现代网络语。不得让胡商角色使用滑稽口音。少量外语词必须经过语言专家核对，并提供中文释义。

### 2.4 传世唐画不是742年的直接视觉记录

《捣练图》现存作品为北宋早期作品，归于宋徽宗名下。《虢国夫人游春图》现存作品也是宋摹本。两者可提供构图、线条和色彩启发，不能单独证明742年街市、服装或建筑细节。

### 2.5 墓葬图像不能直接外推到普通街市

唐墓壁画常反映贵族和官僚的身份、仪仗与理想化生活。它们可支持姿态、器物类别和色彩研究，但不能自动证明西市普通人的日常布置。

### 2.6 当前没有Unity项目

仓库没有 `Assets/`、`Packages/manifest.json` 和 `ProjectSettings/ProjectVersion.txt`。Unity版本、渲染管线、输入系统、Timeline、Cinemachine和Addressables均未验证。

本规范只定义中立JSON合同和未来映射。Unity状态为 `Not validated / not applicable`。

## 3. 产品体验合同

### 3.1 玩家幻想

玩家不是全知侦探。玩家是受身份、时间、关系和证据强度限制的长安居民。核心乐趣来自：

1. 看见不完整的痕迹。
2. 判断痕迹能证明到哪一步。
3. 在时间与关系压力下选择行动。
4. 承受可见且可回顾的后果。
5. 在重玩中发现另一种解释路径。

### 3.2 单回合循环

```text
进入场景
→ 观察表层线索
→ 选择调查、询问或承担风险
→ 规则引擎解析选择
→ 展示具象后果
→ 更新证据板与关系记忆
→ 进入下一事件或章节收束
```

### 3.3 十分钟切片节奏

| 时间 | 玩家任务 | 系统目标 |
|---|---|---|
| 0:00–1:30 | 选择出身并理解冲突 | 首次选择不晚于90秒 |
| 1:30–3:30 | 获取第一条可靠线索 | 教会三级证据 |
| 3:30–6:30 | 遇到关系或时限冲突 | 展示一次具象后果 |
| 6:30–9:00 | 串联线索并承担判断 | 显示另一条被关闭的路径 |
| 9:00–10:30 | 章节回顾 | 形成重玩动机 |

## 4. 状态与表现分层

### 4.1 三层结构

| 层 | 例子 | 是否持久化 | 写入者 |
|---|---|---:|---|
| 权威状态 | 时间、金钱、关系、声望、风险、事件、结局 | 是 | 服务端事务 |
| 派生读模型 | 准入等级、声望带、阵营姿态、时间阶段 | 否，可重算 | 纯规则函数 |
| 表现提示 | 路人侧目、门店拒入、语气变冷、光线变化 | 否 | Web或Unity渲染器 |

### 4.2 派生社会投影

```ts
type DerivedSocialProfile = {
  accessBand: "excluded" | "tolerated" | "admitted" | "trusted"
  prestigeBand: "disgraced" | "suspect" | "ordinary" | "respected"
  factionPosture: Array<{
    factionId: string
    band: "hostile" | "guarded" | "neutral" | "cooperative" | "confidant"
  }>
  reasons: Array<{
    statePath: string
    eventId: string
    consequenceKey: string
  }>
}
```

投影必须满足：

- 相同 `WorldState` 得到相同结果。
- 不读取动画、镜头或音频状态。
- 每项原因能追溯到事件与后果。
- 不作为新的数据库事实写回。

### 4.3 后果演出

数值变化必须映射为可感知反馈，但反馈不能夸大状态。

| 权威变化 | 可用演出 | 禁止演出 |
|---|---|---|
| 市场声望下降1 | 摊主缩短回答、取消赊欠提示 | 全市场立刻敌视玩家 |
| NPC关系下降1 | 停顿变长、称谓变疏、隐藏可选细节 | NPC无规则依据消失 |
| 风险上升2 | 人流减少、鼓点收紧、字幕提示“时限迫近” | 伪造精确历史钟点 |
| 行政声望上升1 | 文书被优先接收、属官语气缓和 | 玩家立即获得官职 |
| 关系达到亲密阈值 | 解锁密谈或家宴事件 | 自动获得全部秘密 |

演出条目必须记录 `presentationReason`。它只能引用已提交的 `consequenceKey`。

## 5. 非线性结构

### 5.1 每条出身线的九事件配额

| 类型 | 数量 | 功能 |
|---|---:|---|
| 主线脊柱 | 5 | 开场、两次证据升级、关键判断、章节收束 |
| 后果事件 | 2 | 兑现先前关系、风险或声望变化 |
| 众生相支线 | 1 | 展示非主角群体的生活压力 |
| 隐藏世界观 | 1 | 由证据或关系阈值开启，不承担主线必要信息 |

现有27个事件仍按 `opening/core/consequence/ending` 保存。新增 `narrativeRole` 只用于编辑与评测，不改变提交语义。

### 5.2 分支规则

- 分支必须由 `RuleExpression`、事件旗标或派生社会投影开启。
- 一个事件最多有五个选择。
- 每个选择只能指向已注册事件。
- 关闭的分支要在章节回顾中说明原因，但不得泄露未发现内容。
- 三条出身线不得在第一章强行汇合为同一结局。
- 隐藏事件不能提供完成主线所必需的唯一史实。

### 5.3 三幕事件结构

每个事件必须填写：

1. `setup`：20–60字，建立地点、人物和可见冲突。
2. `complication`：一条新线索或一个利益冲突。
3. `decision`：3–5个可比较的行动。
4. `aftermath`：明确展示已提交的后果。
5. `foreshadowing`：一条可回收伏笔，不制造无解悬念。

单个事件不应连续使用两次“假身份揭露”或“突然背叛”。反转必须来自先前可见信息。

## 6. 八地点三级证据系统

当前允许的八个地点是：

| 地图编号 | 运行时ID | 名称 | 状态 |
|---|---|---|---|
| M-001 | `western-market` | 西市 | 已发布示意 |
| M-002 | `jin-guang-gate` | 金光门 | 已发布示意 |
| M-003 | `jingzhao-fu` | 京兆府 | 已发布示意 |
| M-004 | `daming-palace` | 大明宫 | 已发布示意 |
| M-005 | `ward-grid` | 坊区网格 | 已发布示意 |
| M-006 | `eastern-market` | 东市 | provisional |
| M-007 | `mingde-gate` | 明德门 | provisional |
| M-008 | `imperial-city` | 皇城官署区 | provisional |

朱雀大街、曲江和安仁坊不在当前八地点合同中。若要加入，必须通过ADR决定替换还是扩容，并新增地图、来源、许可和回归测试。不得把 `ward-grid` 悄悄改名为安仁坊。

### 6.1 三级线索

| 层 | 可见性 | 内容 | 证据要求 |
|---|---|---|---|
| 表层 `surface` | 进入即见 | 形状、位置、损耗、人物公开陈述 | 分类与来源编号 |
| 隐藏 `concealed` | 行动或能力阈值 | 遮挡、遗漏、对照差异 | 发现规则与来源编号 |
| 关联 `relational` | 串联两条以上线索 | 时间、经手、地点或制度关系 | 明确推理步骤，不伪装直接史实 |

### 6.2 线索合同

```ts
type ClueNode = {
  clueId: string
  locationId: string
  layer: "surface" | "concealed" | "relational"
  classification: "史料记载" | "合理重建" | "叙事虚构"
  claimIds: string[]
  sourceIds: string[]
  locatorNotes: string[]
  discoveryRule: RuleExpression[]
  interactionVerb: "observe" | "compare" | "ask" | "test" | "trace"
  linkedClueIds: string[]
  uncertaintyNote: string
}
```

每个地点至少需要：

- 2条表层线索。
- 1条隐藏线索。
- 1条跨地点关联线索。
- 1条明确的“不足以证明”说明。

## 7. 推理板

推理板只允许玩家建立三种连接：

- `supports`：一条线索支持某个有限判断。
- `contradicts`：两条线索不能同时成立。
- `unknown`：证据仍不足。

连接动作不直接改状态。玩家提交假说后，规则引擎把连接集合映射到已注册选择。

动画顺序：

1. 线索卡沿时间顺序进入。
2. 玩家连接两张卡。
3. 系统高亮共同字段。
4. 显示证据等级。
5. 提交后才播放后果。

低动态模式改为淡入和边框变化。颜色不能成为唯一编码。

## 8. NPC生产标准

每名NPC必须填写以下字段：

```ts
type NpcDramaturgy = {
  npcId: string
  publicRole: string
  dailyPressure: string
  publicGoal: string
  privateMotive: string
  fear: string
  resource: string
  falseBelief: string
  moralBoundary: string
  factionId: string
  disclosureGates: Array<{
    band: "hostile" | "guarded" | "neutral" | "cooperative" | "confidant"
    allowedInformationIds: string[]
  }>
  speechRegister: string
  gestureSet: string[]
  voiceDirection: VoiceDirection
  historicalNotes: Array<{
    claimId: string
    sourceIds: string[]
  }>
  publicationStatus: "provisional" | "reviewed" | "published"
}
```

### 8.1 角色逻辑

- “表面身份与真实立场有反差”不是强制模板。
- 每人只需要一个可持续的内在张力。
- 行为必须能由目标、压力、资源和边界解释。
- NPC不得只负责发任务或交付答案。
- 关键信息至少有两个获得路径。
- 恶化关系可减少信息深度，不能无规则地锁死章节。

### 8.2 关系带

| 关系值 | 姿态 | 台词与行为 |
|---:|---|---|
| -10至-4 | hostile | 拒绝非必要交流；只给公开信息 |
| -3至-1 | guarded | 语句变短；省略背景；避免承诺 |
| 0至1 | neutral | 提供角色职责范围内信息 |
| 2至5 | cooperative | 解释动机；允许一次追问 |
| 6至10 | confidant | 开启密谈；透露个人风险，不自动给出真相 |

## 9. 台词规范

### 9.1 台词四层

每段关键台词必须标记：

1. `surfaceMeaning`：角色明说的内容。
2. `subtext`：角色试图隐藏或争取的内容。
3. `clueFunction`：是否提供、修正或阻断线索。
4. `performance`：情绪、语速、重音、停顿和动作。

### 9.2 台词数据

```ts
type DialogueBeat = {
  lineId: string
  eventId: string
  speakerId: string
  audience: string
  textZh: string
  surfaceMeaning: string
  subtext: string
  clueIds: string[]
  requiredRelationshipBand: string
  emotion: "restrained" | "wary" | "urgent" | "warm" | "cold" | "grieving"
  pace: "slow" | "measured" | "quick"
  emphasisWords: string[]
  pauseMs: number[]
  gestureCueIds: string[]
  classification: "叙事虚构"
  factualClaimIds: string[]
}
```

### 9.3 文风红线

- 不使用“OK”“搞定”“躺平”“内卷”等现代网络语。
- 不堆砌“吾、汝、尔等”制造伪古风。
- 不让所有官员引经据典。
- 不把粟特人物写成异域装饰。
- 不把沉默自动解释为心虚。
- 虚构台词只能引用事实性背景，不能被标成史料原话。

## 10. 视觉生产规范

### 10.1 视觉目标

视觉方向是“古画活化”，不是“考古复原已完成”。

三层来源：

| 层 | 用途 | 例子 |
|---|---|---|
| 考古与馆藏 | 器物类别、姿态、材料、纹样范围 | 唐墓壁画、出土器物 |
| 传世与摹本 | 构图、线性节奏、色彩关系 | 《捣练图》《虢国夫人游春图》宋摹本 |
| 电影化设计 | 镜头、光影、景深、节奏 | 明确标为艺术演绎 |

每个资产必须有 `assetEvidenceRecord`。记录来源、可支持范围、不可支持范围和许可。

### 10.2 色彩

| 情境 | 砂纸 | 朱砂 | 靛蓝 | 黄铜 | 禁用 |
|---|---|---|---|---|---|
| 晨市 | 暖米白 | 少量印记 | 灰蓝阴影 | 柔金高光 | 过饱和橙 |
| 正午 | 干燥浅金 | 清晰节点 | 低比例 | 硬质反光 | 全屏泛黄 |
| 黄昏 | 降低明度 | 风险提示 | 增强背景 | 暗金 | 红蓝对撞霓虹 |
| 夜禁 | 冷月白 | 极少 | 深靛主导 | 灯火局部 | 纯黑吞没细节 |

### 10.3 镜头词典

| 镜头 | 功能 | 时长上限 |
|---|---|---:|
| establishing | 建立地点与社会边界 | 5秒 |
| threshold | 进入、拒绝或准入 | 3秒 |
| tabletop | 文书、货样、量具和证据 | 4秒 |
| reverse-shot | 对话关系变化 | 单次6秒 |
| close-detail | 线索、磨损和空白 | 3秒 |
| consequence | 已提交后果 | 4秒 |
| montage | 章节回顾 | 12秒 |

推、拉、摇、移必须有叙事理由。不得在每次对话中持续漂移。慢镜只用于一次不可逆决定或章节终点。

### 10.4 第三人称探索

第三人称自由视角是后续渲染目标，不是Phase 11当前完成项。

第一版限定为：

- 每个地点一个小型探索单元。
- 3–5个交互锚点。
- 不制作无边界开放世界。
- 对话期间锁定移动并明确恢复。
- 关键文字和证据板仍使用DOM或原生UI层。
- 镜头不能计算线索发现或状态变化。

### 10.5 环境动画

环境动画分为三档：

- `ambient`：旗帜、烛火、树叶、水纹。
- `social`：行人、车马、摊位活动。
- `consequence`：拒入、回避、聚拢、散去。

每档必须有低动态替代。人物微动作只能表达可见行为，不得替玩家断定内心。

## 11. 音频生产规范

### 11.1 历史声明

琵琶、筚篥、笙、羯鼓和琴可以作为现代创作的音色来源。除非经过音乐史学者和演奏实践专家核验，不得声称配乐复原了唐代演奏法、音律或具体曲牌。

### 11.2 动态音乐分层

```ts
type MusicState = {
  baseTheme: string
  timeLayer: "morning" | "day" | "dusk" | "night"
  tensionLayer: 0 | 1 | 2 | 3
  socialLayer: "isolated" | "public" | "trusted"
  transitionBars: 1 | 2 | 4
}
```

变化只能读取权威时间、风险和关系投影。音乐不能触发游戏后果。

### 11.3 环境音

每个地点最多五层：

1. 远景底噪。
2. 中景人群或自然声。
3. 近景交互物。
4. 时间阶段层。
5. 后果瞬态层。

“叫卖、驼铃、歌声”等具体素材必须记录：

- 录音或合成来源。
- 表演者授权。
- 语言与文本审校。
- 是否为现代艺术重建。
- 循环点和空间位置。

无权属素材不得进入仓库。

### 11.4 配音

```ts
type VoiceDirection = {
  language: "zh-CN"
  register: string
  emotion: string
  paceWpm: number
  emphasisWords: string[]
  breathBeforeMs: number
  pausesMs: number[]
  gestureCueIds: string[]
  pronunciationStatus: "modern-mandarin"
}
```

- 字幕始终可见。
- 默认不开启自动播放。
- 设备合成音必须显示“现代普通话设备合成音”。
- 真人录音必须有演员授权、版本和撤回处理。
- 不做真人声纹克隆。
- 不声称复原中古汉语或粟特语。

## 12. 跨引擎内容合同

### 12.1 权威链路

```text
编辑JSON
→ 本地Schema校验
→ 历史审校与许可审查
→ Supabase候选表
→ 发布迁移
→ 服务端规则与事务
→ Web或Unity表现层
```

Web与Unity只能发送：

- `sessionId`
- `clientTurnId`
- `expectedStateVersion`
- `choiceId` 或受限自由文本

表现层不得发送 `stateDelta`。

### 12.2 Web映射

- React DOM：字幕、对话、证据板、选项、设置和无障碍。
- CSS或WebGL：光影、镜头和环境动画。
- 浏览器音频：分层音乐、环境声和设备合成音。
- Supabase与SSE：身份、存档和回合提交。

### 12.3 Unity未来映射

只有创建并验证Unity项目后才能落地：

| 中立内容 | Unity候选映射 | 权威性 |
|---|---|---|
| 事件与NPC JSON | 只读ScriptableObject资产 | 非存档 |
| 镜头提示 | Timeline标记与Cinemachine机位 | 表现 |
| 资产ID | Addressables地址 | 表现 |
| 动作提示 | Animator状态或Timeline片段 | 表现 |
| 音频提示 | AudioMixer快照与空间音源 | 表现 |
| 游戏状态 | 服务端API响应 | 权威 |

Unity官方文档明确说明，ScriptableObject适合保存编辑期数据资产，不应被当作部署后存档系统。因此Unity端不能用ScriptableObject替代Supabase。

### 12.4 资产约定

- 共享3D交付格式：GLB或glTF 2.0。
- Unity上游工程可保留FBX，但发布清单必须使用稳定资产ID。
- 纹理必须记录色彩空间、尺寸、压缩和许可。
- 角色、环境、UI、音频、特效分域命名。
- 文件名不能成为公共API。

## 13. 生产工作流

每个事件按以下顺序生产：

1. **史料桌**：建立claim、source和locator。
2. **系统设计**：确定前置条件、选择和确定性后果。
3. **叙事设计**：完成三幕结构、伏笔和回收点。
4. **NPC设计**：检查目标、压力和关系带。
5. **线索设计**：填写三级线索与推理连接。
6. **对话设计**：填写表层、潜台词、线索和演出。
7. **分镜设计**：只表现已有事实和虚构动作。
8. **音频设计**：登记音乐、环境和配音状态。
9. **工程校验**：Schema、引用、分支和状态测试。
10. **公开测试发布**：未审条目保持 `provisional`，并持续显示未认证提示。
11. **外部审阅与晋级**：只有可核审阅通过后，才生成新版本并升级具体条目。

任何后续岗位不得越过前一阶段的阻塞。

### 13.1 Sider Scholar与外部审校

Sider Scholar只用于发现文献、定位开放版本和查询已取得的PDF。工具摘要、搜索结果数量和知识图谱都不是史料。

每个事实性分句必须落到：

```text
claimId
→ sourceId
→ 版本或出版信息
→ 页码、卷次或条目标识
→ 可支持的最小结论
→ 不可外推的边界
→ 审阅者结论
```

无法取得可核页码或卷次时，只能标 `provisional`。外部学者必须在审阅包中逐条选择通过、降级、重写或删除。虚构人物台词不需要伪造史料来源，但其中嵌入的制度、地点、器物和群体性事实仍必须绑定claim。

## 14. 量产配额

### 14.1 每个事件

- 1份三幕节拍表。
- 3–5个选择与后果。
- 3条以上事件—来源链接。
- 1–3个线索。
- 1段关键台词。
- 1个进入镜头。
- 1个后果演出。
- 1个低动态替代。
- 1个声音状态。

### 14.2 每名NPC

- 1份角色张力表。
- 5档关系带响应。
- 至少2个信息获得路径。
- 1组6–10个可复用微动作。
- 1份现代普通话配音方向。
- 1份事实与虚构边界表。

### 14.3 每个地点

- 1个标志性全景。
- 4条以上线索。
- 4个时间阶段。
- 3档人流。
- 1套低动态替代。
- 1份声音分层。
- 1份不确定性与许可说明。

## 15. 评测矩阵v3

目标不是“至少90项”这一最低线，而是240项可复现门禁：

| 类别 | 数量 | 验证内容 |
|---|---:|---|
| 27事件×3基线选择 | 81 | 后果只能来自注册表 |
| 27事件证据绑定 | 27 | claim、source和locator完整 |
| 12 NPC×3关系带 | 36 | 信息深度和语气符合阈值 |
| 8地点×3线索层 | 24 | 发现规则与不确定性完整 |
| 27时间表现 | 27 | 光影、字幕和风险一致 |
| 提示注入 | 15 | 不接受模型越权 |
| 时代错置 | 15 | 拒绝现代物件与制度 |
| 非法状态与重复提交 | 15 | 事务回滚与幂等 |
| **合计** | **240** | 公开候选门禁 |

现有93项阶段10评测只能证明旧机制基线。它们不能替代上述Phase 11评测。

## 16. 发布门禁

Phase 11进入 `public-beta-unreviewed` 必须同时满足：

- 27个事件、12名NPC、8个地点均通过Schema。
- 所有事实性文本有claim、source和locator。
- 100条事件—来源链接完成逐条人工核验。
- 240项评测通过。
- 三条出身线都能进入至少两个不同章节结局。
- 不存在唯一不可替代的隐藏线索。
- 低动态、静音、键盘和屏幕阅读器路径可用。
- 所有音频、图像、模型和字体权属明确。
- 所有未审内容保持 `provisional`。
- 页面持续展示“未经外部历史学家认证”。
- 审阅者列表为空时，不写入姓名、签章或机构背书。
- 公开迁移保留Phase 10回滚点。

把条目晋级为 `reviewed` 或 `published`，或宣称获得外部认证，另需至少一名合格历史学者提交可核审阅证据。公开测试通过不能替代这一门禁。

## 17. 对标机制

这些作品只用于机制研究：

- *Pentiment*：历史视觉形式与人物后果。
- *Return of the Obra Dinn*：观察、归因和证据闭环。
- *Heaven’s Vault*：解释可修正和不确定性累积。
- *Disco Elysium: The Final Cut*：关系、语气和信息深度。

ChronoKalamos不得复制它们的角色、文本、美术资产或具体谜题。

## 18. 研究与技术依据（MLA）

- Museum of Fine Arts Boston. “Court Ladies or Pin-Up Girls? Museum of Fine Arts, Boston, Takes a Close Look at Women in Chinese Paintings.” *Museum of Fine Arts Boston*, 13 Nov. 2014, https://www.mfa.org/news/court-ladies-or-pin-up-girls.
- 辽宁省文化和旅游厅. “辽宁：辽博展出《虢国夫人游春图》《神骏图》古本真迹.” *中华人民共和国文化和旅游部*, 3 Mar. 2014, https://www.mct.gov.cn/whzx/qgwhxxlb/ln/201403/t20140303_780160.htm.
- 中国国家博物馆. “吹排箫乐伎壁画.” *中国国家博物馆*, https://www.chnmuseum.cn/zp/zpml/kgfjp/202111/t20211116_252285.shtml.
- Unity Technologies. “ScriptableObject.” *Unity Manual 6.1*, https://docs.unity3d.com/6000.1/Documentation/Manual/class-ScriptableObject.html.
- Unity Technologies. “Cinemachine.” *Unity Manual*, https://docs.unity3d.com/jp/current/Manual/com.unity.cinemachine.html.
- Unity Technologies. “Timeline.” *Unity Manual 2022.3*, https://docs.unity3d.com/kr/2022.3/Manual/com.unity.timeline.html.
- Obsidian Entertainment. *Pentiment*. 2022. GameFinder catalog record, https://gamebrain.co/game/pentiment.
- Lucas Pope. *Return of the Obra Dinn*. 2018. GameFinder catalog record, https://gamebrain.co/game/return-of-the-obra-dinn.
- inkle Ltd. *Heaven’s Vault*. 2019. GameFinder catalog record, https://gamebrain.co/game/heavens-vault.
- ZA/UM. *Disco Elysium: The Final Cut*. 2019. GameFinder catalog record, https://gamebrain.co/game/disco-elysium-the-final-cut.

项目历史来源仍以 `content/tang-changan-742/sources.json` 为准。本节的博物馆与Unity资料只支持视觉方法和技术管线，不自动支持事件事实。
