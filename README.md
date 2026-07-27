# ChronoKalamos

ChronoKalamos／ΧΡΟΝΟΚΑΛΑΜΟΣ 是有史料边界的 AI 历史人生模拟器。首发切片锁定公元 742 年的唐代长安，地图与时间轴是主要入口。

## 当前边界

- 三种出身：西市粟特商户家庭后辈、长安工匠家庭学徒、京兆基层吏员家庭成员。
- 界面准备中文、英文、法文、希腊文和俄文；史实内容首发只承诺人工审校的中英文。
- AI 回合工程闭环已接入 DeepSeek Chat API 适配层；缺少服务端密钥时只返回“本回合未提交”，不生成伪叙事。
- 当前地图是带来源、时间、许可与不确定性字段的证据示意图，不是可测量的 742 年复原地图。
- 阶段 7 采用免费方案。邮箱正式账户可配置 TOTP；数据库对已启用因子的账户强制 AAL2。
- 短信、手机号登录、Passkey、支付、微信和 QQ 登录均未接入。
- 动态效果支持 `prefers-reduced-motion` 和产品内低动态模式。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

未配置 Supabase 时，界面明确显示“Supabase 未配置”，游客入口只打开开发模拟器，不制造虚假的可恢复账户。

使用 `.env.test` 的真实测试项目进行本地认证预览：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-test-preview.ps1
```

## Supabase 配置

生产浏览器变量：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

阶段 5 服务端变量：

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

`SUPABASE_PUBLISHABLE_KEY` 仍是 publishable key。`SUPABASE_SECRET_KEY` 只供服务端调用提交 RPC，不得进入 `NEXT_PUBLIC_*` 或浏览器构建。`DEEPSEEK_API_KEY` 也只允许存在于服务端运行环境。

真实集成测试变量放在被忽略的 `.env.test`：

```text
SUPABASE_TEST_URL=
SUPABASE_TEST_PUBLISHABLE_KEY=
# 可选：验证服务端提交 RPC，绝不能进入浏览器
SUPABASE_TEST_SECRET_KEY=
# 可选：只使用你控制的测试收件箱
SUPABASE_TEST_UPGRADE_EMAIL=
```

测试项目需要启用匿名登录、手动身份关联，并把生产站和本地地址加入重定向白名单。邮箱确认在正式配置中保持开启。不要把 service-role key 放进浏览器环境。

## 验证

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

最后一项会创建两个真实匿名用户，验证存档、回合、检查点和私有上传隔离。它总会验证浏览器不能直接提交回合；只有配置 `SUPABASE_TEST_SECRET_KEY` 时才进一步验证服务端原子提交和重复回放。测试通过 owner-scoped RPC 清理业务会话，并清理上传对象与元数据；匿名 Auth 用户需要由测试项目的受控管理员清理。只有配置 `SUPABASE_TEST_UPGRADE_EMAIL` 时才发起邮箱升级。缺少 `.env.test` 时测试会跳过；跳过不等于通过。

## 文档入口

- `docs/product-brief.md`：产品边界与验收目标。
- `docs/implementation-plan.md`：阶段状态、实测证据与剩余风险。
- `docs/brand-and-ui.md`、`docs/motion-spec.md`、`docs/i18n-copy.md`：视觉、动效和翻译边界。
- `docs/data-model.md`、`docs/auth.md`、`docs/security-privacy.md`：身份、数据与隐私约束。
- `docs/totp-mfa.md`：免费 TOTP 流程、AAL2 门禁与恢复边界。
- `docs/game-state.md`、`docs/model-routing.md`、`docs/ai-evals.md`：阶段 5 状态、模型边界和评测门槛。
- `docs/provider-onboarding.md`：阶段 7 外部能力的供应商、政策与沙箱门禁。
- `docs/scenario-expansion-template.md`：第二历史场景的来源、许可、规则和 60 回合模板。

### Phase 7 free authentication track

The active direction is email plus TOTP through Supabase Auth. TOTP has no SMS
delivery fee and requires no additional public or secret environment variable.
The retained Twilio and Turnstile preparation code is disabled by default and
has no public identity-panel entry. Passkeys are also deferred.
