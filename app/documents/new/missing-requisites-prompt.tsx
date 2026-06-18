"use client";

import { useState } from "react";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export function MissingRequisitesPrompt({
  title,
  description,
  buttonLabel,
  next,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  next: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-sheet border border-line bg-sheet p-6 shadow-sheet sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex items-center justify-center rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
        >
          {buttonLabel}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-paper/80 px-4 py-8">
          <div className="max-h-full w-full max-w-lg overflow-auto rounded-sheet border border-line bg-sheet p-5 shadow-pop sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Заполните реквизиты
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Укажите БИН/ИИН, данные компании и банковские реквизиты.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-field text-faint transition-colors hover:bg-sunken hover:text-ink"
                aria-label="Закрыть"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <OnboardingForm next={next} />
          </div>
        </div>
      )}
    </>
  );
}
