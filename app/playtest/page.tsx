"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/product-shell";
import { PHASE14_PLAYTEST, PHASE14_THRESHOLDS } from "@/lib/playtest/config";
import {
  getCurrentPlaytestEnrollment,
  joinPhase14Playtest,
  withdrawFromPhase14Playtest,
} from "@/lib/playtest/client";
import type { PlaytestEnrollment } from "@/lib/playtest/schemas";
import { signInAsGuest } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PageState = "loading" | "ready" | "unconfigured" | "error";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PlaytestPage() {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<PageState>(client ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [enrollment, setEnrollment] = useState<PlaytestEnrollment | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!client) {
      setState("unconfigured");
      return;
    }
    setState("loading");
    try {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      setUser(data.user);
      setEnrollment(data.user ? await getCurrentPlaytestEnrollment(client) : null);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试状态读取失败");
      setState("error");
    }
  }, [client]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    if (!client) return () => window.clearTimeout(timer);
    const { data } = client.auth.onAuthStateChange(() => void load());
    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [client, load]);

  async function join() {
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const currentUser = user ?? await signInAsGuest(client);
      const next = await joinPhase14Playtest(client, currentUser.id);
      setUser(currentUser);
      setEnrollment(next);
      setMessage("已加入版本绑定测试。只有此后产生的允许字段会进入评估。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法加入测试");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!client || !enrollment || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await withdrawFromPhase14Playtest(client, enrollment.id);
      setEnrollment(null);
      setMessage("已退出测试，并删除本次测试的同意记录与全部关联事件。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法删除测试记录");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/playtest`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("公开测试邀请链接已复制。请只发给自愿参与者。");
    } catch {
      setMessage(`请手动复制：${link}`);
    }
  }

  return (
    <ProductPageShell
      current="playtest"
      eyebrow="SMALL PUBLIC BETA / 06"
      title="742年长安小规模公开测试"
      intro="这不是商业完成声明。测试只判断一段十分钟历史人生是否易懂、可恢复且有史料边界。"
    >
      <div className="boundary-callout warning" role="note">
        <strong>当前评估：证据不足。</strong>
        <span>尚未形成真实用户样本，外部历史审阅仍待核验。达到阈值前不得标记为商业级完成。</span>
      </div>

      <section className="playtest-grid" aria-label="公开测试协议">
        <article className="playtest-card consent-card">
          <p className="eyebrow">VOLUNTARY CONSENT</p>
          <h2>{enrollment ? "你已加入这次测试" : "先看清采集边界，再决定"}</h2>
          <p>
            参加完全自愿。游客清除浏览器数据、退出或换设备后无法恢复身份。
            退出测试会删除同意记录及其全部关联测试事件，不影响游戏存档。
          </p>
          <dl>
            <div><dt>站点发布</dt><dd>{PHASE14_PLAYTEST.appRelease}</dd></div>
            <div><dt>内容版本</dt><dd>{PHASE14_PLAYTEST.contentVersion}</dd></div>
            <div><dt>场景版本</dt><dd>{PHASE14_PLAYTEST.scenarioVersion}</dd></div>
            <div><dt>保留期限</dt><dd>{PHASE14_PLAYTEST.retentionDays} 天</dd></div>
          </dl>
          {enrollment && <small>同意时间：{formatDate(enrollment.consented_at)}</small>}
          <div className="playtest-actions">
            {enrollment ? (
              <>
                <Link className="primary-button link-as-button" href="/?start=1">开始或继续测试</Link>
                <button className="secondary-button" type="button" onClick={() => void withdraw()} disabled={busy}>
                  {busy ? "正在删除…" : "退出并删除测试数据"}
                </button>
              </>
            ) : (
              <button className="primary-button" type="button" onClick={() => void join()} disabled={busy || state === "unconfigured"}>
                {busy ? "正在建立同意记录…" : "自愿加入测试"}
              </button>
            )}
          </div>
          {message && <p className="inline-message" role="status">{message}</p>}
          {state === "loading" && <p role="status">正在核验当前身份与同意记录…</p>}
          {state === "unconfigured" && <p role="alert">此构建未配置 Supabase，不能记录有效同意。</p>}
        </article>

        <article className="playtest-card">
          <p className="eyebrow">MINIMUM DATA</p>
          <h2>只记录评估必需的事件</h2>
          <ul>
            <li>首次选择耗时、1/3/5 回合完成状态</li>
            <li>选择编号、回合延迟、规范化失败码</li>
            <li>来源数量、史料标签、退出点和恢复路径</li>
            <li>发布版本、内容版本、场景版本和出身线</li>
          </ul>
          <h3>明确不记录</h3>
          <p>自由输入、叙事正文、邮箱、手机号、IP、浏览器指纹、图片、付款信息和模型原始响应。</p>
        </article>

        <article className="playtest-card">
          <p className="eyebrow">PRE-REGISTERED GATES</p>
          <h2>体验与可信度必须同时通过</h2>
          <dl>
            <div><dt>最低样本</dt><dd>{PHASE14_THRESHOLDS.minimumParticipants} 人</dd></div>
            <div><dt>首次选择中位数</dt><dd>≤ 90 秒</dd></div>
            <div><dt>三回合完成率</dt><dd>≥ 60%</dd></div>
            <div><dt>来源覆盖率</dt><dd>100%</dd></div>
            <div><dt>历史审阅</dt><dd>≥ 1 名可核验审阅者</dd></div>
          </dl>
          <p>分支人数少于 3 的单元不公开，避免通过稀疏组合反推参与者。</p>
        </article>

        <article className="playtest-card">
          <p className="eyebrow">INVITATION BOUNDARY</p>
          <h2>邀请仍需真人完成</h2>
          <p>
            本站不会代替你编造参与者或学者签字。请将链接发送给少量自愿用户，
            并请独立历史学者使用审阅包留下可核验的决定和证据。
          </p>
          <button className="secondary-button" type="button" onClick={() => void copyInvite()}>复制测试邀请链接</button>
        </article>
      </section>
    </ProductPageShell>
  );
}

