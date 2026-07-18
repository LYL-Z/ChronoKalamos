# 阶段3数据模型

阶段3只建立身份、存档和私有上传。AI 叙事仍不在本阶段范围内。

## 归属边界

所有用户数据以 Supabase `auth.users.id` 为唯一归属标识。游客和正式邮箱账户使用相同的 UUID 结构。游客绑定邮箱时更新原用户，不复制存档。这样可以保留 `owner_id`，也避免非事务式“搬运存档”。

| 表 | 用途 | 幂等键 | 所有权 |
| --- | --- | --- | --- |
| `profiles` | 语言和展示名 | `id` | `id = auth.uid()` |
| `game_sessions` | 角色和当前世界状态 | `(owner_id, client_session_id)` | `owner_id = auth.uid()` |
| `game_turns` | 已提交回合 | `(owner_id, client_turn_id)` | `owner_id = auth.uid()` |
| `game_checkpoints` | 指定状态版本的快照 | `(session_id, state_version)` | `owner_id = auth.uid()` |
| `user_uploads` | 私有桶对象台账 | `storage_path` | `owner_id = auth.uid()` |

`game_turns` 和 `game_checkpoints` 使用 `(session_id, owner_id)` 复合外键。该约束阻止把自己的子记录挂到其他用户的会话上。RLS 负责运行时可见性，复合外键负责关系完整性；两者不能互相替代。

## 状态版本

`game_sessions.state_version` 从 0 开始。阶段5提交回合时，事务必须同时校验旧版本、写入回合、更新世界状态并生成检查点。阶段3只预留结构，不实现回合推进。

## 迁移

迁移文件为 `supabase/migrations/202607180001_phase3_identity_saves.sql`。迁移会创建私有 `user-uploads` 桶，限制为 PNG、JPEG、WebP，单文件上限 5 MiB。

## 阶段 4 历史内容表

阶段 4 新增只读内容镜像：

| 表 | 用途 | 客户端权限 |
| --- | --- | --- |
| `historical_sources` | 来源书目、定位、许可证和审校状态 | 只能读取 `published = true` |
| `historical_claims` | 事实、合理重建、叙事虚构的最小声明 | 只能读取 `published = true` |
| `historical_claim_sources` | claim 与来源的多对多关系 | 只能读取已发布 claim 的关系 |
| `map_features` | 时间范围、示意几何、不确定性、许可和归属 | 只能读取 `published = true` |
| `map_feature_sources` | 地图要素与来源的多对多关系 | 只能读取已发布要素的关系 |

这五张表不接受浏览器写入。内容作者先修改 `content/tang-changan-742/` 下的 JSON，通过 Zod 和发布脚本后，再更新 Supabase 迁移。`source_ids` 仍保留在主表，关系表提供数据库级外键约束；两者必须保持一致。
