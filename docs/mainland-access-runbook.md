# 中国大陆访问修复运行手册

## 故障结论

`chronokalamos.com` 原先直接指向 Sites 的上游地址。中国大陆访客收到的
Cloudflare 拦截页明确把被访问目标写成 `chatgpt.site`。这不是应用路由、
Supabase 或浏览器兼容问题。

账户自己的 WAF 同时存在一条恒真规则。原表达式为：

```text
(method != GET) OR (method != POST) OR (method != HEAD)
```

任何请求都至少满足其中两项，所以流量进入账户 Zone 后也会被全部拦截。生产
规则已改为 `AND`。它只拦截同时不是 GET、POST、HEAD 的请求。

生产入口现由账户自有的 Cloudflare Worker
`chronokalamos-mainland-edge` 接管。Worker 只代理到固定的 Sites 原生域名，
不接受动态源站参数，也不记录请求正文或身份信息。

## 当前路由

```text
访客
→ chronokalamos.com 的 Cloudflare 区域
→ chronokalamos-mainland-edge
→ chronokalamos.burrows-bandeau-7x.chatgpt.site
→ Sites version 36
```

根域使用代理状态的 `192.0.2.1` 占位 A 记录。Sites 的
`chronokalamos.com` 自定义域名绑定已解除，避免其 Cloudflare for SaaS 映射在
Worker 之前接管请求。Sites 原生域名和版本未删除。

Worker 会保留请求方法、正文、认证头和流式响应。它会重写返回的同源跳转和
`chatgpt.site` Cookie 域。响应头 `x-chronokalamos-edge:
mainland-proxy-v1` 用于确认请求已经经过新链路。

## 验证

```powershell
curl.exe -sS -I https://chronokalamos.com/
curl.exe -sS -I https://chronokalamos.com/playtest
curl.exe -sS https://chronokalamos.com/api/ready
```

前两项应返回 `200` 和 `x-chronokalamos-edge: mainland-proxy-v1`。健康接口
应返回就绪状态。应用 API 的未登录请求仍应按原规则返回 `401`，不能因代理而
绕过鉴权。

中国大陆验证必须使用至少两个独立网络，例如移动数据和家庭宽带。项目团队
无法从境外探针推断所有大陆运营商的实际可达性。

## 回滚

1. 通过 Sites 重新添加 `chronokalamos.com`，取得新的验证记录。
2. 将根域 A 记录从 `192.0.2.1` 恢复为 Sites 返回的目标。历史目标是
   `162.159.143.30` 与 `172.66.3.26`，但回滚时必须以新返回值为准。
3. 完成 Sites 域名验证后，删除
   `chronokalamos.com/* → chronokalamos-mainland-edge`。
4. 确认站点返回 200，且 `x-chronokalamos-edge` 响应头消失。

不能先删除 Worker 路由。当前根域是无源站占位记录，提前删除会使站点不可用。
Worker 脚本可在确认回滚稳定后再删除。

## 边界

这次修复移除了已观察到的 `chatgpt.site` 前置拦截。它不能保证中国大陆所有
地区、运营商和时段永久可达。Cloudflare 的常规全球网络仍位于中国大陆境外。
若产品要求有合同保障的大陆可用性，还需 ICP 备案、合规的境内源站或
Cloudflare China Network 等正式方案。
