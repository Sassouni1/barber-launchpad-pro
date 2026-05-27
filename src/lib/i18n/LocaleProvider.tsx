/**
 * App-wide locale provider with a runtime DOM auto-translator.
 *
 * Strategy:
 *  - Wrap the entire app in <LocaleProvider>.
 *  - When the user toggles to Spanish, every text node in the rendered DOM
 *    is translated. Static UI chrome resolves instantly from `EN_ES` dictionary.
 *    Anything else (DB lesson titles, dynamic toasts, etc.) is queued, sent
 *    in batches to the `translate-text` edge function, cached in localStorage,
 *    and re-applied.
 *  - A MutationObserver re-translates new/changed text as the app navigates.
 *
 * Limitations:
 *  - User-typed input (inputs, textareas, contentEditable) is NEVER touched.
 *  - <option> values, attribute text (placeholders, aria-labels, titles, alt)
 *    are also translated where safe.
 *  - The original English is stored on each node so toggling back to EN is exact.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EN_ES } from "./dictionary";

type Locale = "en" | "es";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
});

export const useLocale = () => useContext(LocaleContext);

const STORAGE_KEY = "bla.locale";
const CACHE_KEY = "bla.translations.es";

// ---- Translation cache (persisted) ----
function loadCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded — ignore */
  }
}

// ---- Helpers ----
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT",
  "SELECT", "OPTION", "SVG", "PATH", "CIRCLE", "RECT", "G", "DEFS",
  "LINEARGRADIENT", "STOP", "USE", "POLYGON", "POLYLINE", "LINE", "ELLIPSE",
]);

// Strings we never translate (brand, numbers, URLs, symbols).
function shouldSkipText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 2) return true;
  // pure number / currency / percent / date-ish
  if (/^[\d\s$€£¥%.,:\-+/()]+$/.test(t)) return true;
  // URL
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true;
  // looks like an email
  if (/^[^\s@]+@[^\s@]+$/.test(t)) return true;
  // single emoji or punctuation
  if (/^[\p{P}\p{S}]+$/u.test(t)) return true;
  // Brand-only
  if (/^(Aion( AI)?|GHL|Stripe|Klarna|Apple Pay|Printful|Lovable|Vimeo|Zoom)$/i.test(t)) return true;
  return false;
}

function nodeAllowed(node: Node): boolean {
  let el: Node | null = node.parentNode;
  while (el) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const e = el as HTMLElement;
      if (SKIP_TAGS.has(e.tagName)) return false;
      if (e.isContentEditable) return false;
      if (e.dataset && e.dataset.noTranslate !== undefined) return false;
      if (e.getAttribute && e.getAttribute("translate") === "no") return false;
    }
    el = el.parentNode;
  }
  return true;
}

// Element-attribute targets that hold user-visible English text.
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"];

interface NodeRecord {
  type: "text" | "attr";
  attr?: string;
  original: string;
}

// Weak map from Node -> original English (so EN restore is exact).
const originalText = new WeakMap<Node, NodeRecord>();
// Weak map from Element -> { attrName -> originalValue }
const originalAttrs = new WeakMap<Element, Record<string, string>>();
function getAttrRecord(e: Element): Record<string, string> {
  let rec = originalAttrs.get(e);
  if (!rec) {
    rec = {};
    originalAttrs.set(e, rec);
  }
  return rec;
}

function collectStrings(root: Node, into: Set<string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!nodeAllowed(n)) return NodeFilter.FILTER_REJECT;
        const t = (n.nodeValue || "").trim();
        if (shouldSkipText(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      // ELEMENT_NODE — used to inspect attributes
      const e = n as HTMLElement;
      if (!e.tagName || SKIP_TAGS.has(e.tagName)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.nodeValue || "").trim();
      if (t) into.add(t);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as HTMLElement;
      for (const attr of TRANSLATABLE_ATTRS) {
        const val = e.getAttribute(attr);
        if (val && !shouldSkipText(val)) into.add(val.trim());
      }
    }
  }
}

function applyTranslations(root: Node, dict: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!nodeAllowed(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      const e = n as HTMLElement;
      if (!e.tagName || SKIP_TAGS.has(e.tagName)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const raw = n.nodeValue || "";
      const trimmed = raw.trim();
      if (!trimmed) continue;
      // Record original on first encounter so we can restore later.
      if (!originalText.has(n)) {
        if (shouldSkipText(trimmed)) continue;
        originalText.set(n, { type: "text", original: trimmed });
      }
      const rec = originalText.get(n)!;
      const translated = dict[rec.original];
      if (translated && translated !== rec.original) {
        // Preserve surrounding whitespace.
        const leading = raw.match(/^\s*/)?.[0] ?? "";
        const trailing = raw.match(/\s*$/)?.[0] ?? "";
        const newVal = leading + translated + trailing;
        if (n.nodeValue !== newVal) n.nodeValue = newVal;
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as HTMLElement;
      for (const attr of TRANSLATABLE_ATTRS) {
        const val = e.getAttribute(attr);
        if (!val) continue;
        const trimmed = val.trim();
        if (shouldSkipText(trimmed)) continue;
        const key = `__attr_${attr}__`;
        // store original on the element via dataset
        if (!e.dataset[key]) e.dataset[key] = trimmed;
        const original = e.dataset[key]!;
        const translated = dict[original];
        if (translated && translated !== original && e.getAttribute(attr) !== translated) {
          e.setAttribute(attr, translated);
        }
      }
    }
  }
}

function restoreOriginals(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const rec = originalText.get(n);
      if (rec) {
        const raw = n.nodeValue || "";
        const leading = raw.match(/^\s*/)?.[0] ?? "";
        const trailing = raw.match(/\s*$/)?.[0] ?? "";
        const newVal = leading + rec.original + trailing;
        if (n.nodeValue !== newVal) n.nodeValue = newVal;
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as HTMLElement;
      for (const attr of TRANSLATABLE_ATTRS) {
        const key = `__attr_${attr}__`;
        const original = e.dataset[key];
        if (original && e.getAttribute(attr) !== original) {
          e.setAttribute(attr, original);
        }
      }
    }
  }
}

// ---- Provider ----
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
    return "en";
  });

  const cacheRef = useRef<Record<string, string>>({ ...EN_ES, ...loadCache() });
  const pendingRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  const flushTimerRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const localeRef = useRef<Locale>(locale);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }, []);

  // Flush queued unknown strings to the edge function.
  const flushQueue = useCallback(async () => {
    if (inFlightRef.current) return;
    const batch = Array.from(pendingRef.current).slice(0, 80);
    if (batch.length === 0) return;
    inFlightRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { texts: batch, target: "es" },
      });
      if (error) throw error;
      const translations = (data as { translations?: Record<string, string> })?.translations ?? {};
      let changed = false;
      for (const [en, es] of Object.entries(translations)) {
        if (typeof es === "string" && es.trim() && es !== en) {
          cacheRef.current[en] = es;
          pendingRef.current.delete(en);
          changed = true;
        }
      }
      // Drop anything the model didn't return so we don't loop forever.
      for (const en of batch) pendingRef.current.delete(en);
      if (changed) {
        saveCache(
          // Persist only the live (non-seed) entries.
          Object.fromEntries(
            Object.entries(cacheRef.current).filter(([k, v]) => EN_ES[k] !== v)
          )
        );
        if (localeRef.current === "es") {
          applyTranslations(document.body, cacheRef.current);
        }
      }
    } catch (err) {
      // Best-effort. Drop the batch from pending to avoid infinite retry loops.
      for (const en of batch) pendingRef.current.delete(en);
      // eslint-disable-next-line no-console
      console.warn("[i18n] translation batch failed", err);
    } finally {
      inFlightRef.current = false;
      // Schedule another flush if more is queued.
      if (pendingRef.current.size > 0) {
        if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = window.setTimeout(flushQueue, 250);
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(flushQueue, 250);
  }, [flushQueue]);

  // Main pass: scan DOM, apply known translations, queue unknown.
  const translatePass = useCallback(() => {
    if (localeRef.current !== "es") return;
    const seen = new Set<string>();
    collectStrings(document.body, seen);
    let queuedAny = false;
    for (const s of seen) {
      if (!(s in cacheRef.current)) {
        pendingRef.current.add(s);
        queuedAny = true;
      }
    }
    applyTranslations(document.body, cacheRef.current);
    if (queuedAny) scheduleFlush();
  }, [scheduleFlush]);

  const scheduleTranslate = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      translatePass();
    });
  }, [translatePass]);

  // Apply / tear down based on locale.
  useEffect(() => {
    localeRef.current = locale;
    document.documentElement.lang = locale;

    if (locale === "es") {
      translatePass();
      // Observe DOM mutations so navigations/dialogs get translated too.
      const obs = new MutationObserver((mutations) => {
        // Ignore mutations we caused ourselves (text-only changes inside text nodes
        // whose value already matches our cache). Cheap heuristic: just re-schedule.
        let relevant = false;
        for (const m of mutations) {
          if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
            relevant = true;
            break;
          }
          if (m.type === "characterData") {
            // If the node's current value is already a translation we set, skip.
            relevant = true;
            break;
          }
          if (m.type === "attributes" && m.attributeName && TRANSLATABLE_ATTRS.includes(m.attributeName)) {
            relevant = true;
            break;
          }
        }
        if (relevant) scheduleTranslate();
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRANSLATABLE_ATTRS,
      });
      observerRef.current = obs;
      return () => {
        obs.disconnect();
        observerRef.current = null;
      };
    }

    // locale === "en" → restore originals and stop observing.
    observerRef.current?.disconnect();
    observerRef.current = null;
    restoreOriginals(document.body);
    return undefined;
  }, [locale, scheduleTranslate, translatePass]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// ---- Floating toggle button ----
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const isEs = locale === "es";

  return (
    <button
      type="button"
      onClick={() => setLocale(isEs ? "en" : "es")}
      data-no-translate
      translate="no"
      aria-label={isEs ? "Switch to English" : "Cambiar a Español"}
      title={isEs ? "Switch to English" : "Cambiar a Español"}
      className={
        "fixed z-[9999] top-3 right-3 md:top-4 md:right-4 " +
        "flex items-center gap-1 rounded-full border border-primary/40 " +
        "bg-background/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-bold " +
        "shadow-lg shadow-black/30 hover:bg-primary/10 hover:border-primary " +
        "transition-all select-none " +
        className
      }
    >
      <span className={isEs ? "text-muted-foreground" : "text-primary"}>EN</span>
      <span className="text-muted-foreground">/</span>
      <span className={isEs ? "text-primary" : "text-muted-foreground"}>ES</span>
      <span className="ml-1 text-[10px] text-muted-foreground hidden sm:inline">
        {isEs ? "Español" : "English"}
      </span>
    </button>
  );
}
