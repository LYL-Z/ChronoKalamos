"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  completeTotpChallenge,
  getTotpMfaSnapshot,
  removeTotpFactor,
  startTotpEnrollment,
  type TotpEnrollment,
  type TotpMfaSnapshot,
} from "@/lib/supabase/totp";

type TotpMfaPanelProps = {
  client: SupabaseClient;
  challengeRequired: boolean;
  onVerified: () => void | Promise<void>;
  onMessage: (message: string) => void;
};

function describeTotpError(error: unknown): string {
  if (!(error instanceof Error)) return "TOTP 操作失败。请稍后重试。";
  const message = error.message.toLowerCase();
  if (message.includes("invalid") || message.includes("expired")) {
    return "验证码无效或已过期。请等待身份验证器生成新码后重试。";
  }
  if (message.includes("aal2")) {
    return "当前会话需要先完成一次 TOTP 验证，才能删除已验证因子。";
  }
  return error.message;
}

export function TotpMfaPanel({
  client,
  challengeRequired,
  onVerified,
  onMessage,
}: TotpMfaPanelProps) {
  const [snapshot, setSnapshot] = useState<TotpMfaSnapshot | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const next = await getTotpMfaSnapshot(client);
    setSnapshot(next);
    const verified = next.factors.filter((factor) => factor.status === "verified");
    setSelectedFactorId((current) => (
      verified.some((factor) => factor.id === current)
        ? current
        : verified[0]?.id ?? ""
    ));
  }, [client]);

  useEffect(() => {
    let active = true;
    void getTotpMfaSnapshot(client)
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setSelectedFactorId(
          next.factors.find((factor) => factor.status === "verified")?.id ?? "",
        );
      })
      .catch((nextError: unknown) => {
        if (active) setError(describeTotpError(nextError));
      });
    return () => {
      active = false;
    };
  }, [client]);

  const verifiedFactors = useMemo(
    () => snapshot?.factors.filter((factor) => factor.status === "verified") ?? [],
    [snapshot],
  );
  const pendingFactors = useMemo(
    () => snapshot?.factors.filter((factor) => factor.status === "unverified") ?? [],
    [snapshot],
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (nextError) {
      setError(describeTotpError(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function beginEnrollment() {
    await run(async () => {
      if (pendingFactors.length > 0) {
        throw new Error("请先完成或移除尚未验证的身份验证器。");
      }
      if (verifiedFactors.length >= 2) {
        throw new Error("当前最多保留两个 TOTP 因子：主验证器与备用验证器。");
      }

      const next = await startTotpEnrollment(
        client,
        verifiedFactors.length === 0 ? "主验证器" : "备用验证器",
      );
      setEnrollment(next);
      setCode("");
      onMessage("TOTP 密钥只在本次配置中显示。请先保存到身份验证器，再输入 6 位验证码。");
    });
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    await run(async () => {
      await completeTotpChallenge(client, enrollment.factorId, code);
      setEnrollment(null);
      setCode("");
      await refresh();
      await onVerified();
      onMessage("TOTP 已启用。其他会话已失效；当前会话已提升为 AAL2。");
    });
  }

  async function verifyExistingFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFactorId) {
      setError("没有可用的已验证 TOTP 因子。");
      return;
    }
    await run(async () => {
      await completeTotpChallenge(client, selectedFactorId, code);
      setCode("");
      await refresh();
      await onVerified();
      onMessage("TOTP 验证完成。当前会话可以访问受保护的存档与私有上传。");
    });
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    await run(async () => {
      await removeTotpFactor(client, enrollment.factorId);
      setEnrollment(null);
      setCode("");
      await refresh();
      onMessage("未完成的 TOTP 配置已移除。");
    });
  }

  async function removeFactor(factorId: string, verified: boolean) {
    await run(async () => {
      if (verified && snapshot?.currentLevel !== "aal2") {
        throw new Error("aal2_required");
      }
      await removeTotpFactor(client, factorId);
      await refresh();
      onMessage(verified ? "TOTP 因子已移除。" : "未完成的 TOTP 因子已清理。");
    });
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      onMessage("TOTP 密钥已复制。请勿把它粘贴到聊天、日志或公开文档。");
    } catch {
      setError("浏览器未允许复制。请在下方密钥框中手动选择并复制。");
    }
  }

  if (!snapshot && !error) {
    return <p className="identity-loading" role="status">正在核验 TOTP 状态…</p>;
  }

  if (challengeRequired) {
    return (
      <section className="totp-panel totp-challenge" aria-labelledby="totp-challenge-title">
        <div className="email-heading">
          <h3 id="totp-challenge-title">需要二次验证</h3>
          <span>AAL2 数据门禁</span>
        </div>
        <p>此账户已启用 TOTP。验证前不会读取或修改存档、回合和私有上传。</p>
        {verifiedFactors.length > 0 ? (
          <form className="login-form" onSubmit={verifyExistingFactor}>
            {verifiedFactors.length > 1 && (
              <>
                <label htmlFor="totp-factor">身份验证器</label>
                <select
                  id="totp-factor"
                  value={selectedFactorId}
                  onChange={(event) => setSelectedFactorId(event.target.value)}
                  disabled={busy}
                >
                  {verifiedFactors.map((factor) => (
                    <option key={factor.id} value={factor.id}>{factor.friendlyName}</option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="totp-login-code">6 位验证码</label>
            <input
              id="totp-login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              disabled={busy}
            />
            <button className="primary-button" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "正在验证…" : "验证并解锁存档"}
            </button>
          </form>
        ) : (
          <p className="identity-warning">会话要求 AAL2，但没有可用的已验证因子。请退出后联系站点管理员重置因子。</p>
        )}
        {error && <p className="totp-error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="totp-panel" aria-labelledby="totp-title">
      <div className="email-heading">
        <h3 id="totp-title">TOTP 身份验证器</h3>
        <span>免费 · 无短信</span>
      </div>
      <p>可使用支持 TOTP 的身份验证器。本站不收集手机号，也不调用短信供应商。</p>

      {enrollment ? (
        <div className="totp-enrollment">
          <Image
            className="totp-qr"
            src={enrollment.qrCode}
            width={192}
            height={192}
            alt="ChronoKalamos TOTP 配置二维码"
            unoptimized
          />
          <p className="identity-warning">二维码与密钥等同于登录凭证。完成后本页不会再次显示。</p>
          <label htmlFor="totp-secret">无法扫码时手动输入</label>
          <div className="totp-secret-row">
            <input id="totp-secret" type="password" value={enrollment.secret} readOnly />
            <button className="text-button" type="button" onClick={copySecret}>复制密钥</button>
          </div>
          <form className="login-form" onSubmit={verifyEnrollment}>
            <label htmlFor="totp-enroll-code">身份验证器中的 6 位验证码</label>
            <input
              id="totp-enroll-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              disabled={busy}
            />
            <button className="primary-button" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "正在核验…" : "核验并启用 TOTP"}
            </button>
            <button className="text-button" type="button" onClick={cancelEnrollment} disabled={busy}>
              取消并删除未验证因子
            </button>
          </form>
        </div>
      ) : (
        <>
          {snapshot?.factors.length ? (
            <div className="totp-factor-list">
              {snapshot.factors.map((factor) => (
                <div key={factor.id}>
                  <span>
                    <strong>{factor.friendlyName}</strong>
                    <small>{factor.status === "verified" ? "已验证" : "配置未完成"}</small>
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => removeFactor(factor.id, factor.status === "verified")}
                    disabled={busy}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="totp-empty">尚未启用。当前账户仍使用邮箱单因素登录。</p>
          )}
          {verifiedFactors.length < 2 && pendingFactors.length === 0 && (
            <button className="primary-button" type="button" onClick={beginEnrollment} disabled={busy}>
              {verifiedFactors.length === 0 ? "启用 TOTP" : "添加备用验证器"}
            </button>
          )}
          {verifiedFactors.length > 0 && (
            <p className="totp-recovery">Supabase 不生成恢复码。建议把第二个 TOTP 因子保存在另一台受控设备。若两个因子都丢失，邮箱登录仍只能到 AAL1，需要管理员审核后重置因子。</p>
          )}
        </>
      )}
      {error && <p className="totp-error" role="alert">{error}</p>}
    </section>
  );
}
