"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ARCHIVE_FIND_EVENT } from "@/lib/ui/find";
import { getChromeCopy, paletteKeywords, type ChromeNavId } from "@/lib/ui/chrome";
import {
  ProductPreferencesContext,
  useProductPreferences,
  useProductPreferencesController,
} from "@/lib/ui/preferences";

type AppProvidersProps = {
  children: ReactNode;
};

const paletteRoutes: Array<{ id: ChromeNavId; href: string }> = [
  { id: "home", href: "/" },
  { id: "saves", href: "/saves" },
  { id: "settings", href: "/settings" },
  { id: "support", href: "/support" },
  { id: "playtest", href: "/playtest" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function trapTab(event: React.KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (event.key !== "Tab" || !root) return;
  const nodes = [...root.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), a[href], textarea:not([disabled]), select:not([disabled])",
  )];
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function ArchiveGrain() {
  return <div className="archive-grain" aria-hidden="true" />;
}

function CommandPalette() {
  const router = useRouter();
  const preferences = useProductPreferences();
  const chrome = getChromeCopy(preferences.locale);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const helpDialogRef = useRef<HTMLElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const routes = paletteRoutes.map((route) => ({
      ...route,
      label: chrome.primaryNav(route.id),
      detail: chrome.paletteDetail[route.id],
      keywords: paletteKeywords[route.id],
    }));
    if (!needle) return routes;
    return routes.filter((route) =>
      `${route.label} ${route.detail} ${route.keywords} ${chrome.navZh[route.id]}`.toLowerCase().includes(needle)
    );
  }, [chrome, query]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    const restore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    window.setTimeout(() => restore?.focus(), 0);
  }, []);

  const openPalette = useCallback(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHelpOpen(false);
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    const restore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    window.setTimeout(() => restore?.focus(), 0);
  }, []);

  const openHelp = useCallback(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    setHelpOpen(true);
    window.setTimeout(() => helpCloseRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const paletteChord = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (paletteChord) {
        event.preventDefault();
        if (open) closePalette();
        else openPalette();
        return;
      }
      const helpChord = event.key === "?" || (event.code === "Slash" && event.shiftKey);
      if (helpChord && !isTypingTarget(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (helpOpen) closeHelp();
        else openHelp();
        return;
      }
      if (event.key === "Escape") {
        if (open) {
          event.preventDefault();
          closePalette();
        } else if (helpOpen) {
          event.preventDefault();
          closeHelp();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeHelp, closePalette, helpOpen, open, openHelp, openPalette]);

  useEffect(() => {
    function onRequestFind() {
      openPalette();
    }
    window.addEventListener(ARCHIVE_FIND_EVENT, onRequestFind);
    return () => window.removeEventListener(ARCHIVE_FIND_EVENT, onRequestFind);
  }, [openPalette]);

  useEffect(() => {
    if (!open && !helpOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [helpOpen, open]);

  function go(href: string) {
    closePalette();
    router.push(href);
  }

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) go(selected.href);
    }
    trapTab(event, dialogRef.current);
  }

  return (
    <>
      {open && (
        <div className="command-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closePalette();
        }}>
          <div
            ref={dialogRef}
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
            onKeyDown={onDialogKeyDown}
          >
            <div className="command-palette-header">
              <p className="eyebrow">ARCHIVE FIND</p>
              <h2 id="command-palette-title">{chrome.findTitle}</h2>
            </div>
            <label className="command-palette-field">
              {chrome.findLabel}
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder={chrome.findPlaceholder}
                aria-controls={listId}
                autoComplete="off"
              />
            </label>
            <div id={listId} className="command-palette-list" role="listbox" aria-label={chrome.findList}>
              {results.map((route, index) => (
                <button
                  key={route.href}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "active" : ""}
                  onClick={() => go(route.href)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <strong>{route.label}</strong>
                  <small>{route.detail}</small>
                </button>
              ))}
            </div>
            {results.length === 0 && <p className="command-palette-empty" role="status">{chrome.findEmpty}</p>}
            <p className="command-palette-hint"><kbd>Ctrl</kbd><kbd>K</kbd> {chrome.findHint}</p>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="command-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeHelp();
        }}>
          <section
            ref={helpDialogRef}
            className="keyboard-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-help-title"
            onKeyDown={(event) => trapTab(event, helpDialogRef.current)}
          >
            <header>
              <div>
                <p className="eyebrow">KEYMAP</p>
                <h2 id="keyboard-help-title">{chrome.helpTitle}</h2>
              </div>
              <button ref={helpCloseRef} className="icon-button" type="button" aria-label={chrome.helpClose} onClick={closeHelp}>×</button>
            </header>
            <div className="keyboard-help-grid">
              <article>
                <h3>{chrome.helpSite}</h3>
                <p><kbd>Ctrl</kbd> 或 <kbd>Cmd</kbd><kbd>K</kbd> {chrome.helpFind}</p>
                <p><kbd>?</kbd> {chrome.helpOpenClose}</p>
                <p><kbd>Esc</kbd> {chrome.helpEscape}</p>
                <p>{chrome.helpSkip}</p>
              </article>
              <article>
                <h3>{chrome.helpGame}</h3>
                <p><kbd>M</kbd> 地图 · <kbd>P</kbd> 属性 · <kbd>B</kbd> 背包</p>
                <p><kbd>R</kbd> 关系 · <kbd>J</kbd> 任务</p>
                <p><kbd>C</kbd> 图鉴 · <kbd>A</kbd> 成就 · <kbd>W</kbd> 天下</p>
                <p><kbd>1</kbd>-<kbd>5</kbd> {chrome.helpFocusChoices}</p>
                <p><kbd>Space</kbd> {chrome.helpFocusAction}</p>
              </article>
            </div>
            <p>{chrome.helpTyping}</p>
          </section>
        </div>
      )}
    </>
  );
}

export function ProductPreferencesProvider({ children }: AppProvidersProps) {
  const value = useProductPreferencesController();
  return (
    <ProductPreferencesContext.Provider value={value}>
      {children}
    </ProductPreferencesContext.Provider>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ProductPreferencesProvider>
      <ArchiveGrain />
      <CommandPalette />
      {children}
    </ProductPreferencesProvider>
  );
}
