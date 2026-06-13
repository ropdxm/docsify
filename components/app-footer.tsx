import Link from "next/link";

// A calm, warm footer for the authenticated app. The animated gradient hairline
// and soft wash live in globals.css (.app-footer); links get a smooth underline
// on hover. Static markup — safe in any server component.
export function AppFooter() {
  return (
    <footer className="app-footer mt-16 border-t border-line">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-xs">
            <Link href="/dashboard" className="group inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-tenge transition-transform duration-200 group-hover:scale-110" />
              <span className="font-semibold tracking-tight">docsify</span>
            </Link>
            <p className="mt-3 text-sm text-muted">
              От «работа сделана» до «счёт отправлен» — за пару минут.
            </p>
          </div>

          <div className="flex gap-10 text-sm sm:gap-14">
            <FooterCol title="Документы">
              <FooterLink href="/dashboard">Все документы</FooterLink>
              <FooterLink href="/incoming">Входящие</FooterLink>
              <FooterLink href="/documents/new">Новый счёт</FooterLink>
              <FooterLink href="/documents/new/dogovor">Новый договор</FooterLink>
            </FooterCol>
            <FooterCol title="Аккаунт">
              <FooterLink href="/profile">Профиль</FooterLink>
              <FooterLink href="/profile">Реквизиты</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-line-soft pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 docsify</span>
          <span>Формы по приказу Минфина РК № 562 · Сделано для бизнеса в Казахстане</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative w-fit text-muted transition-colors duration-200 hover:text-ink"
    >
      {children}
      {/* Smooth underline that grows from the left on hover. */}
      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-tenge transition-all duration-300 ease-out group-hover:w-full" />
    </Link>
  );
}
