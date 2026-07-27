"use client";

import { useEffect, useRef } from "react";

type TurnstileWidgetHandle = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ) => string | number;
  reset: (widgetId?: string | number) => void;
  remove: (widgetId?: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidgetHandle;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile_script_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "phone-auth",
          theme: "dark",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "timeout-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            onError?.("Turnstile 验证失败，请重试。");
          },
        });
      })
      .catch(() => onError?.("Turnstile 组件加载失败，请稍后重试。"));

    return () => {
      active = false;
      if (window.turnstile && widgetIdRef.current !== undefined) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = undefined;
    };
  }, [onError, onToken, siteKey]);

  return <div ref={containerRef} className="turnstile-widget" aria-label="Cloudflare Turnstile 验证" />;
}
