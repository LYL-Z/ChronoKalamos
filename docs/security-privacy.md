# 阶段 3 安全与隐私边界

## 浏览器密钥

浏览器只读取 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。publishable key 用于识别项目，不能绕过 RLS。服务角色密钥不得出现在 `.env.example`、客户端模块、构建产物或 Sites 环境中。

`.env.test` 只存放测试项目 URL 和 publishable key。它被 `.gitignore` 忽略，不能提交到仓库。

Sites 使用预构建归档时，两个 `NEXT_PUBLIC_*` 值必须在客户端构建阶段存在。只设置 Sites 运行时变量不会改写已经生成的浏览器资源。发布前必须同时检查客户端产物只包含公开 URL 与 publishable key，并在未登录访客视图确认邮箱入口和数据库镜像已启用。service-role key 不得参与客户端构建，也不得写入 Sites 环境。

## 数据隔离

以下表全部启用 RLS，并以 `auth.uid()` 检查归属：

- `profiles`
- `game_sessions`
- `game_turns`
- `game_checkpoints`
- `game_turn_requests`
- `user_uploads`

阶段 4 的 `historical_*` 与 `map_*` 表也全部启用 RLS。它们是公开可读、发布态限定的证据镜像，不允许浏览器写入；来源、主张、出身和地图关系由外键与发布策略共同约束。

远端 hardening 迁移还完成了三项修复：

- `private.handle_new_user()` 不再暴露在 `public` schema，且撤销 `anon`、`authenticated` 和 `public` 的执行权限。
- `anon` 没有上述业务表权限；`authenticated` 只获得浏览器实际需要的最小权限。
- 四个外键和 RLS 查询路径新增索引。

阶段 5 撤销了浏览器对 `game_sessions`、`game_turns`、`game_checkpoints` 和 `game_turn_requests` 的直接写权限。会话创建、回合预留和存档删除使用 owner-scoped `SECURITY DEFINER` RPC。原子提交与失败记录进一步限定为 `service_role`；服务端先用访问令牌确认用户，再把已验证的 owner ID 交给服务端包装函数。每个函数固定空 `search_path`。`SUPABASE_SECRET_KEY` 不得进入浏览器构建。

私有桶 `user-uploads` 额外检查桶名、用户 UUID 路径、对象 owner、MIME 和 5 MiB 上限。对象只能通过本人 JWT 或短时签名 URL 读取。应用通过 Storage API 删除对象，不直接修改 `storage` schema。

## 真实验证

```bash
npm run test:supabase:live
```

该测试使用两个独立匿名客户端，验证存档、回合、检查点、上传对象和上传元数据的跨用户不可见性，并验证重复 `clientTurnId` 的幂等行为。测试结束通过 owner-scoped RPC 删除业务会话，并删除上传对象和元数据。匿名 Auth 用户用专用 metadata 标记；删除 Auth 用户仍需要测试项目管理员执行，publishable key 不能承担该权限。

Supabase 顾问的匿名策略提示是预期结果：匿名会话使用 `authenticated` 角色。它不等于开放读取，因为每条策略仍检查 `auth.uid()`。若出现新的 SECURITY DEFINER、未索引外键或匿名表权限告警，必须先修复再发布。
