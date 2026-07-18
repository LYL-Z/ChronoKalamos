"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ZodError } from "zod";
import { isAnonymousUser, linkGuestToEmail, sendEmailMagicLink, signInAsGuest } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listOwnSaves, savePrototypeSession, type SaveSummary } from "@/lib/supabase/saves";
import { uploadPrivateImage } from "@/lib/supabase/uploads";

type IdentityPanelProps = {
  originId: string;
  onGuestStarted: () => void;
  onMessage: (message: string) => void;
};

function describeError(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "输入格式无效。";
  if (error instanceof Error) return error.message;
  return "操作失败。请稍后重试。";
}

function abbreviatedUserId(userId: string): string {
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export function IdentityPanel({ originId, onGuestStarted, onMessage }: IdentityPanelProps) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSession, setLoadingSession] = useState(Boolean(client));
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const userId = user?.id;

  useEffect(() => {
    if (!client) return;

    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) onMessage(`身份读取失败：${error.message}`);
      setUser(data.session?.user ?? null);
      setLoadingSession(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setSaves([]);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [client, onMessage]);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    void listOwnSaves(client)
      .then((nextSaves) => {
        if (active) setSaves(nextSaves);
      })
      .catch((error: unknown) => {
        if (active) onMessage(`存档读取失败：${describeError(error)}`);
      });
    return () => {
      active = false;
    };
  }, [client, onMessage, userId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      onMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function startGuest() {
    if (!client) {
      onMessage("Supabase 尚未配置。当前只能打开前端模拟器，不会建立可恢复存档。");
      onGuestStarted();
      return;
    }

    await run(async () => {
      const guest = user ?? await signInAsGuest(client);
      if (!isAnonymousUser(guest) && user) {
        onMessage("当前已登录正式账户，将使用该账户创建存档。");
      } else {
        onMessage("游客身份已创建。清除浏览器数据、退出登录或换设备后无法恢复该身份。");
      }
      onGuestStarted();
    });
  }

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) {
      onMessage("Supabase 尚未配置，邮箱入口未发送任何邮件。");
      return;
    }

    await run(async () => {
      const redirectTo = `${window.location.origin}/`;
      if (isAnonymousUser(user)) {
        await linkGuestToEmail(client, email, redirectTo);
        onMessage("确认邮件已发送。完成验证后，当前游客 ID 与存档会保留。若邮箱已存在，请改为登录该账户，系统不会自动合并两个用户。 ");
      } else if (!user) {
        await sendEmailMagicLink(client, email, redirectTo);
        onMessage("邮箱登录链接已发送。请在同一浏览器完成验证。 ");
      } else {
        onMessage("当前已经是正式账户，无需再次绑定邮箱。 ");
      }
    });
  }

  async function persistPrototypeSave() {
    if (!client || !user) {
      onMessage("请先创建游客身份或登录邮箱账户。 ");
      return;
    }

    await run(async () => {
      const saved = await savePrototypeSession(client, originId);
      setSaves((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      onMessage("原型存档已幂等写入。重复点击会更新同一存档，不会新建重复记录。 ");
    });
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !client || !user) return;

    await run(async () => {
      await uploadPrivateImage(client, file);
      onMessage("图片已写入私有桶。阶段5接入内容审核前，它不会进入叙事流程。 ");
    });
  }

  async function signOut() {
    if (!client) return;
    await run(async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      onMessage("已退出。若退出的是游客身份，该身份无法再次恢复。 ");
    });
  }

  if (!client) {
    return (
      <div className="identity-panel identity-unconfigured">
        <p className="identity-status"><span className="status-dot warning" />Supabase 未配置</p>
        <p className="identity-warning">这是明确标注的开发模拟器。未设置公开项目地址和 publishable key 时，不会创建账户、存档或上传。</p>
        <button className="primary-button" type="button" onClick={startGuest}>打开游客模拟器</button>
        <p className="identity-prep">微信、QQ、手机号：筹备中，不显示伪登录。</p>
      </div>
    );
  }

  if (loadingSession) {
    return <p className="identity-loading" role="status">正在核验身份边界…</p>;
  }

  return (
    <div className="identity-panel">
      <div className="identity-header">
        <p className="identity-status">
          <span className={`status-dot ${user ? "ready" : "warning"}`} />
          {user ? (isAnonymousUser(user) ? "游客身份" : "正式账户") : "尚未登录"}
        </p>
        {user && <code>{abbreviatedUserId(user.id)}</code>}
      </div>

      {(!user || isAnonymousUser(user)) && (
        <form className="login-form" onSubmit={submitEmail}>
          <label htmlFor="identity-email">{user ? "升级游客账户" : "邮箱登录入口"}</label>
          <input id="identity-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          <button className="primary-button" type="submit" disabled={busy}>{user ? "绑定并保留存档" : "发送登录链接"}</button>
        </form>
      )}

      {!user && <button className="link-button identity-guest-button" type="button" onClick={startGuest} disabled={busy}>以游客身份开始 →</button>}

      {user && (
        <div className="identity-actions">
          {isAnonymousUser(user) && <p className="identity-warning">游客凭证只在当前浏览器保留。清除数据、退出登录或换设备后无法恢复。</p>}
          <button className="primary-button" type="button" onClick={persistPrototypeSave} disabled={busy}>保存当前出身</button>
          <label className="upload-control">
            <span>上传私有图片</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} disabled={busy} />
          </label>
          <button className="text-button" type="button" onClick={signOut} disabled={busy}>退出当前身份</button>
        </div>
      )}

      {saves.length > 0 && (
        <div className="save-list" aria-label="当前用户存档">
          <span>OWN ARCHIVES / {saves.length}</span>
          {saves.slice(0, 3).map((save) => (
            <div key={save.id}>
              <strong>{save.title}</strong>
              <small>v{save.state_version} · {new Date(save.updated_at).toLocaleDateString("zh-CN")}</small>
            </div>
          ))}
        </div>
      )}

      <p className="identity-prep">微信、QQ、手机号：筹备中，不显示伪登录。</p>
    </div>
  );
}
