执行 ChronoKalamos 阶段13，完成生产硬化，不扩充历史内容。

先对账本地与远程Supabase迁移。检查所有RLS、公开RPC、匿名访问策略、私有Storage、删除流程和跨用户隔离。处理或明确记录Supabase Advisor告警，尤其是泄露密码保护、phone_auth_audit策略和SECURITY DEFINER函数。

检查Cloudflare DNS、TLS、CSP、Turnstile、速率限制、WAF和分析配置。无法由当前权限核验的项目必须标记为外部控制台待办。

补充隐私安全日志、AI调用日额度、错误预算、部署健康检查、回滚说明和GitHub Actions门禁。运行lint、类型检查、内容校验、单元测试、契约测试、E2E、RLS和构建。
