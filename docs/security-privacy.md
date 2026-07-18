# 阶段 3 安全与隐私边界

## 浏览器密钥

浏览器只读取 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。publishable key 用于识别项目，不能绕过 RLS。服务角色密钥不得出现在 `.env.example`、客户端模块、构建产物或 Sites 环境中。

`.env.test` 只存放测试项目 URL 和 publishable key。它被 `.gitignore` 忽略，不能提交到仓库。生产 Sites 只配置两个 `NEXT_PUBLIC_*` 变量。

## 数据隔离

以下表全部启用 RLS，并以 `auth.uid()` 检查归属：

- `profiles`
- `game_sessions`
- `game_turns`
- `game_checkpoints`
- `user_uploads`

阶段 4 的 `historical_*` 与 `map_*` 表也全部启用 RLS。它们是公开可读、发布态限定的证据镜像，不允许浏览器写入；来源、主张、出身和地图关系由外键与发布策略共同约束。

远端 hardening 迁移还完成了三项修复：

- `private.handle_new_user()` 不再暴露在 `public` schema，且撤销 `anon`、`authenticated` 和 `public` 的执行权限。
- `anon` 没有上述业务表权限；`authenticated` 只获得浏览器实际需要的最小 CRUD 权限。
- 四个外键和 RLS 查询路径新增索引。

私有桶 `user-uploads` 额外检查桶名、用户 UUID 路径、对象 owner、MIME 和 5 MiB 上限。对象只能通过本人 JWT 或短时签名 URL 读取。应用通过 Storage API 删除对象，不直接修改 `storage` schema。

## 真实验证

```bash
npm run test:supabase:live
```

该测试使用两个独立匿名客户端，验证存档、上传对象和上传元数据的跨用户不可见性，并验证重复 client ID 的幂等行为。测试结束会删除业务数据；测试用户用专用 metadata 标记，并在管理端确认后清理。

Supabase 顾问的匿名策略提示是预期结果：匿名会话使用 `authenticated` 角色。它不等于开放读取，因为每条策略仍检查 `auth.uid()`。若出现新的 SECURITY DEFINER、未索引外键或匿名表权限告警，必须先修复再发布。
