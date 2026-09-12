"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PHASE14_PLAYTEST } from "@/lib/playtest/config";
import { getChromeCopy, type ChromeNavId } from "@/lib/ui/chrome";
import { requestArchiveFind } from "@/lib/ui/find";
import { useOnlineStatus, useProductPreferences } from "@/lib/ui/preferences";

type ProductPageShellProps = {
  current: "home" | "saves" | "settings" | "support" | "playtest";
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

const navigation: Array<{ id: ChromeNavId; href: string }> = [
  { id: "home", href: "/" },
  { id: "saves", href: "/saves" },
  { id: "settings", href: "/settings" },
  { id: "support", href: "/support" },
  { id: "playtest", href: "/playtest" },
];

export function BrandLockup({ homeLabel = "ChronoKalamos 首页" }: { homeLabel?: string }) {
  return (
    <Link className="brand" href="/" aria-label={homeLabel}>
      <span className="brand-mark" aria-hidden="true" title="朱文印"><span>ZW</span></span>
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
  const chrome = getChromeCopy(preferences.locale);

  return (
    <main className={`product-page ${preferences.lowMotion ? "low-motion" : ""}`}>
      <a className="skip-link" href="#main-content">{chrome.skip}</a>
      <header className="masthead product-masthead">
        <BrandLockup homeLabel={chrome.brandHome} />
        <nav className="product-nav" aria-label="主导航">
          {navigation.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={current === item.id ? "page" : undefined}
            >
              <span>{chrome.primaryNav(item.id)}</span>
              <small>{chrome.secondaryNav(item.id)}</small>
            </Link>
          ))}
          <button
            className="product-find"
            type="button"
            aria-keyshortcuts="Control+K"
            onClick={requestArchiveFind}
          >
            <span>{chrome.findButton}</span>
            <small>Ctrl+K</small>
          </button>
        </nav>
      </header>
      {!online && (
        <div className="network-banner" role="alert">
          <strong>{chrome.offlineTitle}</strong>
          <span>{chrome.offlineBody}</span>
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
        <span>742 CE · CHANG’AN · {PHASE14_PLAYTEST.editionLabel}</span>
        <span>16+ · 外部历史学者认证待定 · 不接支付、短信、微信、QQ 或 Passkey · Ctrl+K 查找 · ? 键位</span>
      </footer>
    </main>
  );
}
