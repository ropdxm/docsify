import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/loading";
import { cn } from "@/lib/ui";
import { BrandLogo } from "@/components/brand-logo";

// The app's primary navbar. The docsify brand always returns to the main page
// (/dashboard). Shared across the authenticated list pages so navigation is
// identical everywhere.
export function AppHeader({
  companyName,
  active,
  incomingCount = 0,
}: {
  companyName: string;
  active?: "documents" | "incoming";
  incomingCount?: number;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            aria-label="docsify - на главную"
            className="group flex items-center"
          >
            <BrandLogo className="size-8 transition-transform duration-200 group-hover:scale-105" />
          </Link>

          {/* Primary nav (desktop) */}
          <nav className="ml-1 hidden items-center gap-0.5 text-sm sm:flex">
            <NavTab href="/dashboard" current={active === "documents"}>
              Документы
            </NavTab>
            <NavTab
              href="/incoming"
              current={active === "incoming"}
              badge={incomingCount}
            >
              Входящие
            </NavTab>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          {/* Incoming entry on mobile (nav tabs are hidden there). */}
          <Link
            href="/incoming"
            aria-label="Входящие договоры"
            className="relative rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink sm:hidden"
          >
            Входящие
            {incomingCount > 0 && <Badge count={incomingCount} floating />}
          </Link>

          <Link
            href="/profile"
            className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <span className="hidden max-w-[14rem] truncate sm:inline">
              {companyName}
            </span>
            <span className="sm:hidden">Профиль</span>
          </Link>
          <form action={logout}>
            <SubmitButton className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink">
              Выйти
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavTab({
  href,
  current,
  badge = 0,
  children,
}: {
  href: string;
  current?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 font-medium transition-colors",
        current ? "bg-sunken text-ink" : "text-muted hover:bg-sunken/60 hover:text-ink"
      )}
    >
      {children}
      {badge > 0 && <Badge count={badge} />}
    </Link>
  );
}

function Badge({ count, floating }: { count: number; floating?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.125rem] items-center justify-center rounded-pill bg-tenge px-1 text-[11px] font-semibold leading-tight text-on-tenge",
        floating
          ? "absolute -right-0.5 -top-0.5 h-4"
          : "h-[1.125rem]"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
