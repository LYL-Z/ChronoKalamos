# 阶段 5：DeepSeek 模型路由与安全边界

当前生产适配器是 `DeepSeekChatProvider`。它只在服务端通过 `fetch` 调用
DeepSeek Chat Completions API。浏览器不会接触 API key、系统提示词、原始模型响应或私有图片地址。

默认配置：

```text
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
SUPABASE_SECRET_KEY=
```

DeepSeek 请求使用 `response_format: { type: "json_object" }`。模型输出先解析为
JSON，再由 `narrativeExpressionSchema`、来源集合和允许选项集合校验。JSON 模式不是数据库契约；
Zod 校验失败时最多重试一次，第二次仍失败则只写入失败状态。

`AIProvider` 保持两个动作：

1. `moderate` 在本地执行确定性的提示注入筛查。
2. `generate` 只返回 `title`、`text`、`choiceVariants` 和 `sourceIds`。

`choiceVariants` 只能改写下一事件已经发布的选择。它必须保持选择 ID 与数量不变。模型不能返回状态、关系、风险、地点、人物、物品、章节或结局字段。所有状态变化都来自 `EventTemplate.choices[].consequence`。

DeepSeek 当前适配器只接受文字回合。图片回合返回 `image_not_supported`，不会把图片
URL 转发给模型。启用视觉模型前必须单独完成供应商能力、隐私和安全评估。

缺少 `DEEPSEEK_API_KEY` 或 `SUPABASE_SECRET_KEY` 时，接口返回 `turn.failed`，世界状态
保持原版本。模型不能直接写数据库。提交和失败 RPC 只允许 `service_role`。

测试使用确定性的 fixture provider。生产只使用 DeepSeek 适配器。若增加其他供应商，
必须复用同一 Zod 输出契约，不得绕过规则引擎或直接写库。
