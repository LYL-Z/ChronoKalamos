"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const interfaceLocales = ["zh", "en", "fr", "el", "ru"] as const;
export type InterfaceLocale = (typeof interfaceLocales)[number];
export type TextScale = "standard" | "large";
export type InterfaceDensity = "compact" | "standard" | "comfortable";
export type EvidenceDefault = "game" | "evidence";

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

export function readInitialEvidenceMode(): boolean {
  if (typeof window === "undefined") return false;
  return readStorage("chronokalamos-evidence-default") === "evidence";
}

export function readInitialSkipBoot(): boolean {
  if (typeof window === "undefined") return false;
  return readStorage("chronokalamos-skip-boot") === "true";
}

export function readInitialBriefingDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return readStorage("chronokalamos-briefing-dismissed") === "true";
}

export type ProductPreferences = {
  locale: InterfaceLocale;
  lowMotion: boolean;
  textScale: TextScale;
  density: InterfaceDensity;
  highContrast: boolean;
  evidenceDefault: EvidenceDefault;
  skipBoot: boolean;
  briefingDismissed: boolean;
  ready: boolean;
  setLocale: (value: InterfaceLocale) => void;
  setLowMotion: (value: boolean) => void;
  setTextScale: (value: TextScale) => void;
  setDensity: (value: InterfaceDensity) => void;
  setHighContrast: (value: boolean) => void;
  setEvidenceDefault: (value: EvidenceDefault) => void;
  setSkipBoot: (value: boolean) => void;
  dismissBriefing: () => void;
};

const ProductPreferencesContext = createContext<ProductPreferences | null>(null);

export function useProductPreferencesController(): ProductPreferences {
  const [locale, setLocaleState] = useState<InterfaceLocale>("zh");
  const [lowMotion, setLowMotionState] = useState(false);
  const [textScale, setTextScaleState] = useState<TextScale>("standard");
  const [density, setDensityState] = useState<InterfaceDensity>("standard");
  const [highContrast, setHighContrastState] = useState(false);
  const [evidenceDefault, setEvidenceDefaultState] = useState<EvidenceDefault>("game");
  const [skipBoot, setSkipBootState] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLocale = readStorage("chronokalamos-locale");
      const storedTextScale = readStorage("chronokalamos-text-scale");
      const storedDensity = readStorage("chronokalamos-density");
      const storedEvidenceDefault = readStorage("chronokalamos-evidence-default");
      setLocaleState(interfaceLocales.includes(storedLocale as InterfaceLocale)
        ? storedLocale as InterfaceLocale
        : "zh");
      setLowMotionState(readInitialLowMotion());
      setTextScaleState(storedTextScale === "large" ? "large" : "standard");
      setDensityState(["compact", "standard", "comfortable"].includes(storedDensity ?? "")
        ? storedDensity as InterfaceDensity
        : "standard");
      setHighContrastState(readStorage("chronokalamos-high-contrast") === "true");
      setEvidenceDefaultState(storedEvidenceDefault === "evidence" ? "evidence" : "game");
      setSkipBootState(readInitialSkipBoot());
      setBriefingDismissed(readInitialBriefingDismissed());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = "zh-CN";
    document.documentElement.dataset.locale = locale;
    document.documentElement.dataset.motion = lowMotion ? "reduced" : "full";
    document.documentElement.dataset.textScale = textScale;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.contrast = highContrast ? "high" : "standard";
  }, [density, highContrast, locale, lowMotion, ready, textScale]);

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

  const setDensity = useCallback((value: InterfaceDensity) => {
    setDensityState(value);
    writeStorage("chronokalamos-density", value);
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    setHighContrastState(value);
    writeStorage("chronokalamos-high-contrast", String(value));
  }, []);

  const setEvidenceDefault = useCallback((value: EvidenceDefault) => {
    setEvidenceDefaultState(value);
    writeStorage("chronokalamos-evidence-default", value);
  }, []);

  const setSkipBoot = useCallback((value: boolean) => {
    setSkipBootState(value);
    writeStorage("chronokalamos-skip-boot", String(value));
  }, []);

  const dismissBriefing = useCallback(() => {
    setBriefingDismissed(true);
    writeStorage("chronokalamos-briefing-dismissed", "true");
  }, []);

  return useMemo(() => ({
    locale,
    lowMotion,
    textScale,
    density,
    highContrast,
    evidenceDefault,
    skipBoot,
    briefingDismissed,
    ready,
    setLocale,
    setLowMotion,
    setTextScale,
    setDensity,
    setHighContrast,
    setEvidenceDefault,
    setSkipBoot,
    dismissBriefing,
  }), [
    briefingDismissed,
    density,
    dismissBriefing,
    evidenceDefault,
    highContrast,
    locale,
    lowMotion,
    ready,
    setDensity,
    setEvidenceDefault,
    setHighContrast,
    setLocale,
    setLowMotion,
    setSkipBoot,
    setTextScale,
    skipBoot,
    textScale,
  ]);
}

export { ProductPreferencesContext };

export function useProductPreferences(): ProductPreferences {
  const context = useContext(ProductPreferencesContext);
  if (!context) {
    throw new Error("useProductPreferences requires ProductPreferencesProvider");
  }
  return context;
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

export async function copyPlainText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
