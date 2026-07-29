"use client";

import { useCallback, useEffect, useState } from "react";

export const interfaceLocales = ["zh", "en", "fr", "el", "ru"] as const;
export type InterfaceLocale = (typeof interfaceLocales)[number];
export type TextScale = "standard" | "large";

export const localeOptions: Array<{ value: InterfaceLocale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "el", label: "Ελληνικά" },
  { value: "ru", label: "Русский" },
];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The preference remains active for the current document.
  }
}

export function readInitialLowMotion(): boolean {
  if (typeof window === "undefined") return false;
  const stored = readStorage("chronokalamos-low-motion");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useProductPreferences() {
  const [locale, setLocaleState] = useState<InterfaceLocale>("zh");
  const [lowMotion, setLowMotionState] = useState(false);
  const [textScale, setTextScaleState] = useState<TextScale>("standard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLocale = readStorage("chronokalamos-locale");
      const storedTextScale = readStorage("chronokalamos-text-scale");
      setLocaleState(interfaceLocales.includes(storedLocale as InterfaceLocale)
        ? storedLocale as InterfaceLocale
        : "zh");
      setLowMotionState(readInitialLowMotion());
      setTextScaleState(storedTextScale === "large" ? "large" : "standard");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    document.documentElement.dataset.motion = lowMotion ? "reduced" : "full";
    document.documentElement.dataset.textScale = textScale;
  }, [locale, lowMotion, ready, textScale]);

  const setLocale = useCallback((value: InterfaceLocale) => {
    setLocaleState(value);
    writeStorage("chronokalamos-locale", value);
  }, []);

  const setLowMotion = useCallback((value: boolean) => {
    setLowMotionState(value);
    writeStorage("chronokalamos-low-motion", String(value));
  }, []);

  const setTextScale = useCallback((value: TextScale) => {
    setTextScaleState(value);
    writeStorage("chronokalamos-text-scale", value);
  }, []);

  return {
    locale,
    lowMotion,
    textScale,
    ready,
    setLocale,
    setLowMotion,
    setTextScale,
  };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
