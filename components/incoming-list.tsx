import Link from "next/link";
import type { IncomingDogovor } from "@/lib/incoming";
import { formatDateRu } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { cn } from "@/lib/ui";

function IconContract({ className }: { className?: string }) {
  // A signature on a line — matches the договор icon used elsewhere.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16c1.7 0 2.1-7 3.5-7 1.2 0 1 5 2.2 5 1 0 1.3-2.3 2.5-2.3 1 0 1.2 1.8 2.3 1.8 1 0 1.6-1.2 2.5-1.2" />
      <path d="M3 20h18" />
    </svg>
  );
}

/**
 * The list of incoming договоры (contracts another business sent to us). Each
 * row opens the public document page where the user signs as the client.
 */
export function IncomingList({ items }: { items: IncomingDogovor[] }) {
  return (
    <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
      {items.map((d, i) => {
        const st = STATUS[d.status] ?? STATUS.sent;
        // 'sent' = the sender signed and it's awaiting OUR signature.
        const awaitingMe = d.status === "sent";
        return (
          <div
            key={d.id}
            className={cn(
              "relative px-4 py-3.5 transition-colors hover:bg-sunken/40 sm:px-5",
              i > 0 && "border-t border-line-soft"
            )}
          >
            <Link
              href={`/p/${d.share_token}`}
              className="absolute inset-0"
              aria-label={`Открыть договор ${d.number} от ${d.from_name}`}
            />
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-card bg-[#e7eef7] text-[#3a5a8c]"
                  aria-hidden
                >
                  <IconContract className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{d.from_name}</span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-xs font-medium",
                        st.cls
                      )}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-faint">
                    <span className="font-medium text-muted">
                      {d.title?.trim() || "Договор"}
                    </span>{" "}
                    {d.number} · от {formatDateRu(new Date(d.date))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-line-soft pt-2.5 text-sm sm:border-0 sm:pt-0">
                {awaitingMe ? (
                  <span className="inline-flex items-center gap-1.5 rounded-field bg-tenge px-3.5 py-2 font-semibold text-on-tenge shadow-soft">
                    Подписать
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-tenge-ink">
                    ✓ Подписан
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
