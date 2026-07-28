# 阶段 10：叙事合同

## 权限分层

阶段 10 把“叙事表达”和“游戏事实”分开。

| 层 | 可以决定 | 不可以决定 |
| --- | --- | --- |
| 编辑事件目录 | 前置条件、选择、状态变化、关系记忆、风险、下一事件、结局、证据范围 | 绕过发布状态或来源要求 |
| 规则引擎 | 选择解析、前置条件判断、确定性后果、下一状态 | 新增未注册事件或后果 |
| DeepSeek | 叙事标题、正文、已允许选项的等义改写、已检索来源编号 | 状态、人物、地点、物品、关系、风险、章节或结局 |
| Supabase 事务 | 核对事件—选择—后果绑定并一次提交 | 接受模型直接写入或重复推进 |

模型输出只有：

```ts
type NarrativeExpression = {
  title: string
  text: string
  choiceVariants: Array<{
    id: `choice-${1 | 2 | 3 | 4 | 5}`
    label: string
    intent: string
  }>
  sourceIds: string[]
}
```

下一事件没有选择时，`choiceVariants` 必须为空。其他情况下，ID 集合必须与下一事件完全一致。少一个、多一个或替换一个都会使本回合失败。

## 事实标签

事件模板固定一个三级标签。模型无权提高证据等级。

- `史料记载`：事件中直接陈述的事实有明确来源支持。
- `合理重建`：制度与生活边界有来源支持，但具体人物行动无法直接证实。
- `叙事虚构`：人物、对话或连接事件用于游戏叙事。

来源编号必须同时属于本回合检索结果和当前事件证据范围。任一条件不满足时，本回合不提交。

## 失败语义

模型输出失败后最多重试一次。第二次仍失败时：

- `world_state` 不变；
- `state_version` 不变；
- 不建立检查点；
- 请求保留可审计的失败代码；
- 相同 `clientTurnId` 不会再次调用模型。

图片输入仍未接入 DeepSeek。自由文本不是自由创建后果。它只映射到当前事件声明的 `freeTextChoiceId`。界面必须公开说明这一限制。

## API

- `GET /api/scenarios/:scenarioId/manifest`：公开读取已发布场景合同。
- `GET /api/game-sessions/:id/chapters`：本人读取章节和事件进度。
- `GET /api/game-sessions/:id/recap`：本人读取即时回顾。
- `POST /api/game-sessions/:id/replay-summary`：章节结束后固化重玩摘要。

后三个接口需要 Bearer 身份，并通过 RLS 读取本人会话。服务端密钥不进入浏览器。
