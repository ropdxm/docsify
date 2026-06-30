"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/ui";

export type DocumentSortValue = "newest" | "oldest" | "type";

const OPTIONS: Array<{ value: DocumentSortValue; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "type", label: "По типу документа" },
];

export function DocumentSort({ value }: { value: DocumentSortValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeLabel =
    OPTIONS.find((option) => option.value === value)?.label ?? OPTIONS[0].label;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function select(nextValue: DocumentSortValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === "newest") params.delete("sort");
    else params.set("sort", nextValue);

    const query = params.toString();
    setOpen(false);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div ref={rootRef} className="relative z-20 shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Сортировка: ${activeLabel}`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-field border border-line bg-sheet px-3 text-left text-sm text-muted shadow-soft outline-none transition-colors hover:border-line-strong hover:bg-sunken/60 focus-visible:ring-2 focus-visible:ring-tenge/25",
          pending && "pointer-events-none opacity-65"
        )}
      >
        <SortIcon className="size-4 shrink-0 text-faint" />
        <span className="whitespace-nowrap font-medium text-ink">
          {activeLabel}
        </span>
        <ChevronIcon
          className={cn(
            "size-3.5 shrink-0 text-faint transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Сортировка документов"
          className="absolute right-0 top-full mt-1.5 w-56 overflow-hidden rounded-card border border-line bg-sheet p-1.5 shadow-pop"
        >
          {OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => select(option.value)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-field px-3 py-2 text-left text-sm transition-colors hover:bg-sunken",
                  selected && "bg-tenge-tint/70 font-medium text-ink"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-tenge">
                  {selected ? <CheckIcon className="size-4" /> : null}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SortIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h10M4 11h7M4 16h4" />
      <path d="M17 18V5m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3.5 10 4 4 9-9" />
    </svg>
  );
}
