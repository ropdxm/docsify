// Shared class strings so auth, onboarding and dashboard stay on the same
// design system as the document form (warm paper, tenge teal, sunken inputs).

export const field =
  "w-full rounded-field bg-sunken px-3 py-2.5 text-sm text-ink placeholder:text-ghost outline-none transition-colors focus-visible:bg-sheet focus-visible:ring-2 focus-visible:ring-ring";

export const label = "mb-1.5 block text-sm font-medium text-muted";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-field border border-line bg-sheet px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40";

export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}
