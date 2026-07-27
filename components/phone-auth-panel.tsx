"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

type PublicConfig = {
  phoneAuthEnabled?: boolean;
  phoneAuthProvider?: string;
  turnstileSiteKey?: string;
};

function runtimeConfig(): PublicConfig {
  if (typeof document === "undefined") return {};
  const script = document.getElementById("chronokalamos-public-config");
  if (!script?.textContent) return {};
  try {
    const parsed: unknown = JSON.parse(script.textContent);
    return parsed && typeof parsed === "object" ? parsed as PublicConfig : {};
  } catch {
    return {};
  }
}

export function PhoneAuthPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const config = runtimeConfig();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const siteKey = config.turnstileSiteKey?.trim();

  if (!config.phoneAuthEnabled || config.phoneAuthProvider !== "twilio" || !siteKey) return null;

  async function submitStart() {
    if (!token) {
      onMessage("请先完成 Turnstile 验证。");
      return;
    }
    setBusy(true);
    const nextRequestId = crypto.randomUUID();
    try {
      const response = await fetch("/api/auth/phone/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, turnstileToken: token, requestId: nextRequestId }),
      });
      const payload = await response.json() as { message?: string; code?: string };
      if (!response.ok) throw new Error(payload.message ?? "验证码发送失败。");
      setRequestId(nextRequestId);
      setSent(true);
      setToken("");
      onMessage("验证码已发送。请在有效期内完成校验。");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "验证码发送失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitCheck() {
    if (!token || !requestId) {
      onMessage("请重新完成 Turnstile 验证。");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/phone/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, turnstileToken: token, requestId: crypto.randomUUID() }),
      });
      const payload = await response.json() as { message?: string; approved?: boolean };
      if (!response.ok || !payload.approved) throw new Error(payload.message ?? "验证码校验失败。");
      setToken("");
      onMessage("号码已通过 Twilio Verify 校验；Supabase Auth 绑定仍需单独启用，当前不会把号码当作唯一恢复凭证。");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "验证码校验失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="phone-auth-panel" aria-labelledby="phone-auth-title">
      <div className="email-heading"><label id="phone-auth-title" htmlFor="phone-auth-number">手机号验证入口</label><span>Twilio Verify / 中国大陆</span></div>
      <input id="phone-auth-number" type="tel" inputMode="numeric" autoComplete="tel" placeholder="13800138000" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy || sent} />
      {sent && <input id="phone-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="输入验证码" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />}
      <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={onMessage} />
      <button className="primary-button" type="button" onClick={() => void (sent ? submitCheck() : submitStart())} disabled={busy}>{busy ? "处理中…" : sent ? "校验验证码" : "发送验证码"}</button>
      <p className="email-hint">每个号码60秒内最多发送一次；单个 IP 每日最多10次。试用账号只接受 Twilio 已验证的目的号码。</p>
    </section>
  );
}
