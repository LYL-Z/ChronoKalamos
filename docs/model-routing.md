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
JSON，再由 `turnGenerationSchema` 和历史规则引擎校验。JSON 模式不是数据库契约；
Zod 校验失败时最多重试一次，第二次仍失败则只写入失败状态。

`AIProvider` 保持两个动作：

1. `moderate` 在本地执行确定性的提示注入筛查。
2. `generate` 返回叙事、3—5 个选项、候选状态变化和来源编号。

DeepSeek 当前适配器只接受文字回合。图片回合返回 `image_not_supported`，不会把图片
URL 转发给模型。启用视觉模型前必须单独完成供应商能力、隐私和安全评估。

缺少 `DEEPSEEK_API_KEY` 或 `SUPABASE_SECRET_KEY` 时，接口返回 `turn.failed`，世界状态
保持原版本。模型不能直接写数据库。提交和失败 RPC 只允许 `service_role`。

测试使用确定性的 fixture provider。生产只使用 DeepSeek 适配器。若增加其他供应商，
必须复用同一 Zod 输出契约，不得绕过规则引擎或直接写库。
