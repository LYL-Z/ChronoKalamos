"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useOnlineStatus, useProductPreferences } from "@/lib/ui/preferences";

type ProductPageShellProps = {
  current: "home" | "saves" | "settings" | "support" | "playtest";
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

const navigation = [
  { id: "home", href: "/", label: "新开始", english: "Begin" },
  { id: "saves", href: "/saves", label: "历史存档", english: "Archives" },
  { id: "settings", href: "/settings", label: "个人设置", english: "Settings" },
  { id: "support", href: "/support", label: "支持说明", english: "Support" },
  { id: "playtest", href: "/playtest", label: "公开测试", english: "Playtest" },
] as const;

export function BrandLockup() {
  return (
    <Link className="brand" href="/" aria-label="ChronoKalamos 首页">
      <span className="brand-mark" aria-hidden="true"><span>ZW</span></span>
      <span className="brand-copy">
        <strong>CHRONOKALAMOS</strong>
        <small>史料边界 · A LIFE IN RECORD</small>
      </span>
    </Link>
  );
}

export function ProductPageShell({
  current,
  eyebrow,
  title,
  intro,
  children,
}: ProductPageShellProps) {
  const preferences = useProductPreferences();
  const online = useOnlineStatus();

  return (
    <main className={`product-page ${preferences.lowMotion ? "low-motion" : ""}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="masthead product-masthead">
        <BrandLockup />
        <nav className="product-nav" aria-label="主导航">
          {navigation.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={current === item.id ? "page" : undefined}
            >
              <span>{item.label}</span>
              <small>{item.english}</small>
            </Link>
          ))}
        </nav>
      </header>
      {!online && (
        <div className="network-banner" role="alert">
          <strong>当前离线</strong>
          <span>页面偏好仍可使用，但身份、存档与回合不会提交。恢复网络后请重试。</span>
        </div>
      )}
      <section className="product-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>
      <div id="main-content" className="product-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="product-footer">
        <span>742 CE · CHANG’AN · PHASE 14 SMALL BETA</span>
        <span>外部历史学者认证待定 · 不接支付、短信、微信、QQ 或 Passkey</span>
      </footer>
    </main>
  );
}
