"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";

type LoadingContextValue = {
  /** Increment the busy count - locks the screen until the matching stop(). */
  start: () => void;
  /** Decrement the busy count. */
  stop: () => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within <LoadingProvider>");
  return ctx;
}

/**
 * Mirror a local `pending`/`isPending` flag into the global overlay. Balanced:
 * starts when pending turns true, stops when it turns false or the component
 * unmounts - so it survives both redirects and validation errors.
 */
export function useGlobalPending(pending: boolean): void {
  const { start, stop } = useLoading();
  useEffect(() => {
    if (!pending) return;
    start();
    return () => stop();
  }, [pending, start, stop]);
}

/**
 * A submit button that locks the screen while its form's action is in flight.
 * Drop-in for `<button>` inside any `<form action={…}>`.
 */
export function SubmitButton({
  children,
  pendingChildren,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingChildren?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  useGlobalPending(pending);
  return (
    <button {...rest} disabled={disabled || pending} aria-busy={pending}>
      {pending && pendingChildren ? pendingChildren : children}
    </button>
  );
}

const SHOW_DELAY_MS = 120; // ignore instant (cached) navigations
const SAFETY_MS = 12_000; // never let the lock stick

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(0);
  const [navPending, setNavPending] = useState(false);
  const pathname = usePathname();
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => setBusy((n) => n + 1), []);
  const stop = useCallback(() => setBusy((n) => Math.max(0, n - 1)), []);

  const clearNavTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    showTimer.current = null;
    safetyTimer.current = null;
  }, []);

  // The URL committed (link nav, redirect, or browser back/forward) → the
  // destination is ready, so drop the navigation lock. Synchronising UI state to
  // the browser's URL is a legitimate external-system sync, not the cascading
  // render the generic lint rule warns about.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNavPending(false);
    clearNavTimers();
  }, [pathname, clearNavTimers]);

  // Lock the screen when an internal link navigation begins. Detected in the
  // capture phase, before Next handles the click; cleared when the URL commits.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return; // new tab/window
      if (anchor.hasAttribute("download")) return;
      if (/^(#|mailto:|tel:|blob:|javascript:)/i.test(href)) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external
      if (url.pathname.startsWith("/api/")) return; // downloads / endpoints
      const samePage =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;
      if (samePage) return; // hash-only or no-op

      clearNavTimers();
      showTimer.current = setTimeout(() => setNavPending(true), SHOW_DELAY_MS);
      safetyTimer.current = setTimeout(() => {
        setNavPending(false);
        clearNavTimers();
      }, SAFETY_MS);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [clearNavTimers]);

  // Tidy up on unmount.
  useEffect(() => clearNavTimers, [clearNavTimers]);

  const visible = busy > 0 || navPending;

  return (
    <LoadingContext.Provider value={{ start, stop }}>
      {children}
      <LoadingOverlay visible={visible} />
    </LoadingContext.Provider>
  );
}

function LoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-0 z-[200] grid place-items-center transition-opacity duration-200 ease-out",
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* Flat translucent scrim - NO backdrop-filter. A full-screen blur must
          re-rasterize the page behind it every frame (and the page is being
          re-rendered mid-navigation), which starves the compositor and makes the
          spinner stutter. A plain dim is painted once and stays on the GPU. */}
      <div className="absolute inset-0 bg-paper/70" />
      <div
        role="status"
        aria-live="polite"
        aria-label="Загрузка"
        className="relative flex items-center justify-center rounded-sheet bg-sheet px-9 py-8 shadow-pop ring-1 ring-line"
      >
        <span className="loader" />
        <span className="sr-only">Загрузка…</span>
      </div>
    </div>
  );
}
