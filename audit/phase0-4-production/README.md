# 阶段 0–4 生产复核

日期：2026-07-18

## 结论

第 16 版已部署到生产 URL。Sites 访问策略为 `public`，策略修订号为 2。未登录、未获站点白名单授权的访客可以直接进入 ChronoKalamos，不再经过 ChatGPT 访问闸门。

公开访客视图显示真实 Supabase Auth 邮箱入口。访客可以切换“验证链接”和“密码登录”；本次复核没有提交邮箱或触发邮件发送。阶段 4 内容也从 Supabase 已发布镜像读取，页面状态为 `SUPABASE / PUBLISHED MIRROR`。

## 发现与修复

首次公开复核第 15 版时，站点虽已开放，但应用仍显示“Supabase 未配置”和本地内容回退。原因是 Sites 运行时变量不会改写已经生成的浏览器资源；`NEXT_PUBLIC_*` 必须在构建客户端产物时存在。

第 16 版使用测试项目的公开 URL 与 publishable key 重新构建。构建产物只包含这两个浏览器公开值，不包含 service-role key 或其他私密凭证。重新部署后，公开访客视图恢复真实邮箱入口和数据库内容镜像。

## 证据

- `01-sites-access-gate.png`：第 15 版公开前的旧访问闸门，仅作变更前证据。
- `02-public-mobile-email.png`：390 × 844 公共访客完整页面。
- `03-public-desktop-email.png`：1280px 公共访客页面，显示邮箱登录和数据库内容镜像。
- `04-public-mobile-email-focus.png`：390px 邮箱面板聚焦视图。
- DOM 检查得到一个邮箱表单，密码模式同时显示邮箱与密码字段。
- 390px 视口 `scrollWidth` 为 375；1280px 视口 `scrollWidth` 为 1265，均无文档级横向溢出。
