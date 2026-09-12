"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/product-shell";
import { copyPlainText, useOnlineStatus } from "@/lib/ui/preferences";

type HealthState = "loading" | "healthy" | "degraded" | "offline";

export default function SupportPage() {
  const online = useOnlineStatus();
  const [health, setHealth] = useState<HealthState>("loading");
  const [healthDetail, setHealthDetail] = useState("正在读取公开健康端点。");
  const [copied, setCopied] = useState(false);

  const checkHealth = useCallback(async () => {
    if (!online) {
      setHealth("offline");
      setHealthDetail("设备离线，无法核验服务端状态。");
      return;
    }
    setHealth("loading");
    setHealthDetail("正在读取公开健康端点。");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { status?: string; service?: string };
      setHealth(payload.status === "ok" ? "healthy" : "degraded");
      setHealthDetail(`${payload.service ?? "chronokalamos"} · ${payload.status ?? "unknown"}`);
    } catch (error) {
      setHealth("degraded");
      setHealthDetail(error instanceof Error ? error.message : "健康检查失败");
    }
  }, [online]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkHealth(), 0);
    return () => window.clearTimeout(timer);
  }, [checkHealth]);

  async function copyDiagnostics() {
    const text = [
      "ChronoKalamos support diagnostics",
      `URL: ${window.location.href}`,
      `Online: ${navigator.onLine}`,
      `Health: ${health} (${healthDetail})`,
      `Time: ${new Date().toISOString()}`,
      `User agent: ${navigator.userAgent}`,
    ].join("\n");
    const ok = await copyPlainText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <ProductPageShell
      current="support"
      eyebrow="ARCHIVE / 04"
      title="支持说明"
      intro="先说明系统边界，再给出可恢复路径。这里不把筹备中的供应商能力伪装成可用功能。"
    >
      <section className="support-status" aria-labelledby="service-status-title">
        <div>
          <p className="eyebrow">SERVICE STATUS</p>
          <h2 id="service-status-title">公开服务状态</h2>
        </div>
        <div className={`health-indicator ${health}`} role="status" aria-live="polite">
          <span className="status-dot" />
          <strong>{health === "healthy" ? "可访问" : health === "loading" ? "核验中" : health === "offline" ? "设备离线" : "降级"}</strong>
          <small>{healthDetail}</small>
        </div>
        <button className="secondary-button" type="button" onClick={() => void checkHealth()}>重新检查</button>
      </section>

      <div className="support-grid">
        <article className="support-card">
          <h2>回合失败或断线</h2>
          <p>失败回合不会提交世界状态。先恢复网络，再使用原回合的“重试本回合”。系统会复用同一个 clientTurnId，避免重复推进。</p>
        </article>
        <article className="support-card">
          <h2>存档不可见</h2>
          <p>确认当前浏览器使用的是创建存档的身份。游客退出或清除浏览器数据后无法恢复。正式账户可用邮箱和 TOTP 恢复。</p>
        </article>
        <article className="support-card">
          <h2>史料与地图争议</h2>
          <p>记录事件 ID、来源编号和地图节点 ID。示意地图不声称复原精确坐标。外部历史学者认证目前待定。</p>
        </article>
        <article className="support-card">
          <h2>当前不可用能力</h2>
          <p>图片叙事、短信、微信、QQ、支付和 Passkey 均未启用。界面不会请求相机或麦克风权限。</p>
        </article>
        <article className="support-card">
          <h2>查找与键位</h2>
          <p>全站使用 Ctrl+K 或 Cmd+K 查找页面，使用问号键打开键位说明。游戏内 M/P/B/R/J 切换系统，1 到 5 只聚焦选项，空格只聚焦行动卷宗，不会自动提交。</p>
        </article>
        <article className="support-card">
          <h2>隐私与权限</h2>
          <p>浏览器只携带公开项目地址和 publishable key。相机、麦克风、地理位置和支付权限保持关闭。游客存档不能跨设备恢复。诊断摘要不含密钥、邮箱或叙事正文。</p>
        </article>
      </div>

      <section className="method-ledger" aria-labelledby="method-ledger-title">
        <p className="eyebrow">HISTORICAL METHOD</p>
        <h2 id="method-ledger-title">三级史料标签</h2>
        <div className="method-ledger-grid">
          <article>
            <strong>史料记载</strong>
            <p>存在可定位的古籍或制度记录。标签只覆盖来源能支撑的范围，不等于角色真实存在。</p>
          </article>
          <article>
            <strong>合理重建</strong>
            <p>多个来源共同支持背景，但细节不能全部坐实。重建必须写出推断边界。</p>
          </article>
          <article>
            <strong>叙事虚构</strong>
            <p>姓名、家庭、账簿、对话和结局用于让游戏继续。虚构条目不伪装成史料人物。</p>
          </article>
        </div>
      </section>

      <section className="diagnostic-card" aria-labelledby="diagnostic-title">
        <div>
          <p className="eyebrow">PRIVACY-SAFE DIAGNOSTICS</p>
          <h2 id="diagnostic-title">复制最小诊断信息</h2>
          <p>只复制页面地址、联网状态、健康状态、时间和浏览器标识。不包含密钥、账户 ID、邮箱、存档内容或模型提示。</p>
        </div>
        <button className="primary-button" type="button" onClick={() => void copyDiagnostics()}>
          {copied ? "已复制" : "复制诊断摘要"}
        </button>
      </section>
    </ProductPageShell>
  );
}
