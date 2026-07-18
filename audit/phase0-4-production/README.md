# 阶段 0–4 生产复核

日期：2026-07-18

## 结论

第 15 版已部署到生产 URL。Sites 当前访问策略仍为 `custom`，外部未授权访客首先看到 ChatGPT 访问闸门。该闸门位于 ChronoKalamos 应用之前，因此邮箱登录和历史内容无法在未通过 Sites 闸门的访客视图中出现。

## 证据

- `01-sites-access-gate.png`：生产站当前可见页面。
- DOM 只包含 `You're almost in`、`Continue with ChatGPT` 和隐私政策链接。
- 站点项目仍是 `custom` 访问模式，允许列表只有站点所有者。

这不是 Supabase 登录失败。应用内部已实现邮箱验证链接和密码登录；若要让全球访客直接看到它，需要另行批准将 Sites 访问模式改为 `public`，再做一次公开访问复核。
