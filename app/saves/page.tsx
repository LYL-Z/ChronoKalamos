"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/product-shell";
import { isAnonymousUser } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listOwnSaves, type SaveSummary } from "@/lib/supabase/saves";
import { useOnlineStatus } from "@/lib/ui/preferences";

type LoadState = "loading" | "ready" | "empty" | "signed-out" | "unconfigured" | "error";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SavesPage() {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const online = useOnlineStatus();
  const [user, setUser] = useState<User | null>(null);
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [state, setState] = useState<LoadState>(client ? "loading" : "unconfigured");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!client) {
      setState("unconfigured");
      return;
    }
    if (!online) {
      setError("当前设备离线。存档列表没有从数据库刷新。");
      setState("error");
      return;
    }

    setState("loading");
    setError("");
    try {
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const currentUser = data.user;
      setUser(currentUser);
      if (!currentUser) {
        setSaves([]);
        setState("signed-out");
        return;
      }
      const nextSaves = await listOwnSaves(client);
      setSaves(nextSaves);
      setState(nextSaves.length ? "ready" : "empty");
    } catch (loadError) {
      setError(describeError(loadError));
      setState("error");
    }
  }, [client, online]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    if (!client) return;
    const { data } = client.auth.onAuthStateChange(() => void load());
    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [client, load]);

  return (
    <ProductPageShell
      current="saves"
      eyebrow="ARCHIVE / 02"
      title="历史存档"
      intro="这里读取当前 Supabase 身份实际可见的存档。列表不使用演示数据，也不会绕过 RLS。"
    >
      {user && isAnonymousUser(user) && (
        <div className="boundary-callout warning" role="note">
          <strong>游客身份只能由当前浏览器恢复。</strong>
          <span>清除浏览器数据、主动退出或换设备后，匿名身份和存档无法找回。请先在首页绑定邮箱。</span>
        </div>
      )}

      {state === "loading" && (
        <div className="state-card" role="status" aria-live="polite">
          <span className="state-spinner" aria-hidden="true" />
          <strong>正在核验身份与存档边界…</strong>
          <p>只读取当前用户通过 RLS 可见的 game_sessions。</p>
        </div>
      )}

      {state === "signed-out" && (
        <div className="state-card">
          <strong>当前没有登录身份。</strong>
          <p>先回到首页创建游客身份，或使用邮箱登录。登录后此页会自动重新读取。</p>
          <Link className="primary-button link-as-button" href="/">前往身份入口</Link>
        </div>
      )}

      {state === "unconfigured" && (
        <div className="state-card error">
          <strong>当前构建没有 Supabase 公开配置。</strong>
          <p>因此不能显示真实存档。本站不会用本地假数据替代。</p>
          <Link className="secondary-button link-as-button" href="/support">查看支持说明</Link>
        </div>
      )}

      {state === "error" && (
        <div className="state-card error" role="alert">
          <strong>存档读取失败。</strong>
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={() => void load()} disabled={!online}>重试读取</button>
        </div>
      )}

      {state === "empty" && (
        <div className="state-card">
          <strong>这个身份还没有存档。</strong>
          <p>新游戏首次建立权威会话后，记录会出现在这里。</p>
          <Link className="primary-button link-as-button" href="/?start=1">开始第一段人生</Link>
        </div>
      )}

      {state === "ready" && (
        <section className="save-library" aria-labelledby="save-library-title">
          <header>
            <div>
              <p className="eyebrow">OWNED RECORDS</p>
              <h2 id="save-library-title">{saves.length} 份可见存档</h2>
            </div>
            <button className="text-button" type="button" onClick={() => void load()}>刷新</button>
          </header>
          <div className="save-grid">
            {saves.map((save) => (
              <article key={save.id} className="save-card">
                <div className="save-card-heading">
                  <span className={`save-status ${save.status}`}>{save.status}</span>
                  <span>v{save.state_version}</span>
                </div>
                <h3>{save.title}</h3>
                <dl>
                  <div><dt>场景</dt><dd>{save.scenario_id}</dd></div>
                  <div><dt>内容版本</dt><dd>{save.content_version}</dd></div>
                  <div><dt>最后写入</dt><dd>{formatDate(save.updated_at)}</dd></div>
                  <div><dt>存档 ID</dt><dd><code>{save.id.slice(0, 8)}</code></dd></div>
                </dl>
                <Link className="primary-button link-as-button" href={`/?session=${encodeURIComponent(save.id)}`}>
                  {save.status === "ended" ? "查看结局记录" : "继续这一段人生"}
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </ProductPageShell>
  );
}
