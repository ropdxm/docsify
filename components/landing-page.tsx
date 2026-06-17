"use client";

import { useEffect } from "react";
import Link from "next/link";
import { STATUS } from "@/lib/status";

/* ------------------------------------------------------------------ utils -- */

function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** Scroll-reveal wrapper. Hidden until it enters the viewport, then drifts up. */
function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn("lp-reveal", className)}
      style={{ ["--lp-delay" as string]: `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ============================================================== landing == */

export function LandingPage() {
  // One observer reveals every `.lp-reveal` once it scrolls into view.
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".lp-reveal")
    );
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-full overflow-x-clip">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <DashboardShowcase />
      <Philosophy />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------------- nav */

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <span className="size-2.5 rounded-full bg-tenge" />
      <span className="font-semibold tracking-tight">docsify</span>
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-1 text-sm text-muted md:flex">
          <NavLink href="#how">Как это работает</NavLink>
          <NavLink href="#features">Возможности</NavLink>
          <NavLink href="#dashboard">Дашборд</NavLink>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="rounded-field px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Войти
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-field bg-tenge px-3.5 py-1.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
          >
            Начать
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-field px-3 py-1.5 transition-colors hover:bg-sunken hover:text-ink"
    >
      {children}
    </a>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative">
      <div className="lp-aurora pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        {/* copy */}
        <div>
          <div
            className="lp-rise inline-flex items-center gap-2 rounded-pill border border-line bg-sheet px-3 py-1 text-xs font-medium text-muted shadow-soft"
            style={{ animationDelay: "0ms" }}
          >
            <span className="size-1.5 rounded-full bg-tenge" />
            Не ЭДО - инструмент, чтобы получить деньги
          </div>

          <h1
            className="lp-rise mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            От «работа сделана» до «счёт отправлен» -{" "}
            <span className="text-tenge-ink">за пару минут.</span>
          </h1>

          <p
            className="lp-rise mt-5 max-w-xl text-pretty text-lg text-muted"
            style={{ animationDelay: "160ms" }}
          >
            Счета и акты для ИП и ТОО в Казахстане. Сохраните клиента один раз,
            отправьте документ ссылкой и видьте, кто уже заплатил - без Word,
            печатей и потерянных PDF в WhatsApp.
          </p>

          <div
            className="lp-rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-field bg-tenge px-6 py-3 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
            >
              Создать аккаунт
              <IconArrowRight className="size-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-field border border-line bg-sheet px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-sunken"
            >
              Как это работает
            </a>
          </div>

          <ul
            className="lp-rise mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-faint"
            style={{ animationDelay: "320ms" }}
          >
            {[
              "Официальные формы РК",
              "Автозаполнение по БИН из КГД",
              "Отправка ссылкой",
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <IconCheck className="size-4 text-tenge" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* visual */}
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="lp-rise relative mx-auto w-full max-w-md" style={{ animationDelay: "200ms" }}>
      {/* The document sheet - the heart of the product. */}
      <div className="relative overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div className="inline-flex rounded-field bg-sunken p-0.5 text-xs font-medium">
            <span className="rounded-[7px] bg-sheet px-2.5 py-1 text-ink shadow-soft">
              Счёт на оплату
            </span>
            <span className="px-2.5 py-1 text-muted">Акт</span>
          </div>
          <StatusPill status="sent" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <div className="text-xs text-faint">От кого</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
              ИП «ЖДМ»
              <IconCheck className="size-3.5 text-tenge" />
            </div>
            <div className="font-mono text-xs text-faint">БИН 050916501298</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-medium tracking-tight">
              СФ-2026-014
            </div>
            <div className="text-xs text-faint">от 10.06.2026</div>
          </div>
        </div>

        <div className="mt-4 space-y-2 px-5">
          {[
            ["Разработка сайта", "1 × 450 000", "450 000 ₸"],
            ["Поддержка, июнь", "2 × 75 000", "150 000 ₸"],
          ].map(([desc, qty, sum]) => (
            <div
              key={desc}
              className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 text-sm last:border-0"
            >
              <span className="min-w-0 flex-1 truncate">{desc}</span>
              <span className="text-faint tabular-nums">{qty}</span>
              <span className="w-24 text-right font-medium tabular-nums">{sum}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-end justify-between border-t border-line bg-tenge-tint/40 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-muted">Итого к оплате</div>
            <div className="text-xs text-faint">НДС не облагается</div>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-tenge-ink">
            600 000 ₸
          </div>
        </div>
      </div>

      {/* Floating accent - KGD verified lookup. */}
      <div className="lp-float absolute -left-4 -top-5 hidden w-56 rounded-card border border-tenge/25 bg-raised p-3 shadow-pop sm:block">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-field bg-tenge-tint text-tenge-ink">
            <IconSearch className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="font-mono text-xs text-faint">110240013813</div>
            <div className="truncate text-sm font-medium">ТОО «PHYTO-APIPHARM»</div>
          </div>
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-pill bg-tenge-tint px-2 py-0.5 text-[11px] font-medium text-tenge-ink">
          ✓ Реестр КГД
        </div>
      </div>

      {/* Floating accent - awaiting payment. */}
      <div className="lp-float-slow absolute -bottom-6 -right-3 hidden w-44 rounded-card border border-line bg-raised p-3.5 shadow-pop sm:block">
        <div className="text-xs text-faint">Ожидает оплаты</div>
        <div className="mt-0.5 text-lg font-bold tracking-tight tabular-nums text-tenge-ink">
          1 250 000 ₸
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-paid-ink">
          <IconCheck className="size-3.5" />
          +320 000 ₸ за июнь
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ problem */

function Problem() {
  const pains: Array<[React.ReactNode, string, string]> = [
    [<IconKeyboard key="i" className="size-5" />, "Реквизиты вручную", "Каждый раз вбиваете БИН, адрес и директора клиента в Word."],
    [<IconChat key="i" className="size-5" />, "PDF тонут в WhatsApp", "Отправили - и потеряли. Кто оплатил, кто нет - непонятно."],
    [<IconEye key="i" className="size-5" />, "Не видно статуса", "Открыл ли клиент документ, принял ли его, заплатил ли."],
    [<IconPhone key="i" className="size-5" />, "Догоняете звонками", "Напоминать об оплате приходится вручную, по одному."],
  ];
  return (
    <section className="border-t border-line-soft bg-sheet/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="max-w-2xl">
          <SectionEyebrow>Проблема</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Деньги застревают на 7–14 дней.
          </h2>
          <p className="mt-3 text-lg text-muted">
            Не потому что клиент не хочет платить - а потому что счёт долго
            оформляется, теряется в переписке и про него забывают.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pains.map(([icon, title, desc], i) => (
            <Reveal key={title} as="article" delay={i * 80}>
              <div className="group h-full rounded-card border border-line bg-sheet p-5 shadow-soft transition-transform duration-300 hover:-translate-y-1">
                <span className="inline-flex size-10 items-center justify-center rounded-field bg-late-tint text-late-ink">
                  {icon}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  const steps: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
    status: keyof typeof STATUS;
  }> = [
    { icon: <IconDoc className="size-5" />, title: "Создайте документ", desc: "Счёт или акт за минуту. Клиент и реквизиты - из сохранённых.", status: "draft" },
    { icon: <IconLink className="size-5" />, title: "Отправьте ссылкой", desc: "Уникальная ссылка. Клиент открывает без регистрации.", status: "sent" },
    { icon: <IconEye className="size-5" />, title: "Клиент принимает", desc: "Видит счёт, скачивает PDF или Excel, подтверждает.", status: "signed" },
    { icon: <IconWallet className="size-5" />, title: "Следите за оплатой", desc: "Отметьте «Оплачено» - и двигайтесь к следующему.", status: "paid" },
  ];
  return (
    <section id="how" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow center>Как это работает</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Четыре шага. Меньше трёх кликов на каждый.
          </h2>
          <p className="mt-3 text-lg text-muted">
            Один прозрачный путь: от черновика до отметки «оплачено».
          </p>
        </Reveal>

        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* connecting hairline on desktop */}
          <div className="pointer-events-none absolute inset-x-0 top-5 hidden h-px bg-line lg:block" />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="relative flex h-full flex-col rounded-card border border-line bg-sheet p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-10 items-center justify-center rounded-field bg-tenge-tint text-tenge-ink ring-4 ring-paper">
                    {s.icon}
                  </span>
                  <span className="font-mono text-2xl font-bold text-line-strong">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{s.desc}</p>
                <div className="mt-4">
                  <StatusPill status={s.status} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- features */

function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-line-soft bg-sheet/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="max-w-2xl">
          <SectionEyebrow>Возможности</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Всё, чтобы выставить счёт и получить деньги.
          </h2>
          <p className="mt-3 text-lg text-muted">
            Никаких лишних модулей. Только то, что закрывает цикл оплаты.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {/* КГД autofill - wide hero cell */}
          <Reveal className="md:col-span-4">
            <FeatureCard
              icon={<IconSearch className="size-5" />}
              title="Автозаполнение по БИН из КГД"
              desc="Введите 12 цифр - название, директор и адрес подтянутся из реестра налогоплательщиков. С пометкой «проверено»."
            >
              <KgdMini />
            </FeatureCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={80}>
            <FeatureCard
              icon={<IconUsers className="size-5" />}
              title="База клиентов"
              desc="Сохраните клиента один раз - и переиспользуйте в любом документе."
            >
              <ClientsMini />
            </FeatureCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={120}>
            <FeatureCard
              icon={<IconDoc className="size-5" />}
              title="Счёт и акт"
              desc="Два документа, которые нужны каждый день: счёт на оплату и АВР."
            >
              <div className="flex gap-2">
                <DocChip label="Счёт на оплату" active />
                <DocChip label="Акт (АВР)" />
              </div>
            </FeatureCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={160}>
            <FeatureCard
              icon={<IconStamp className="size-5" />}
              title="Официальные формы"
              desc="PDF и Excel по формам Минфина РК. Клиент не задаст лишних вопросов."
            >
              <div className="flex gap-2">
                <FormatChip label="PDF" />
                <FormatChip label="Excel" />
                <span className="inline-flex items-center rounded-pill border border-line bg-paper px-2 py-0.5 text-[11px] text-faint">
                  Форма Р-1
                </span>
              </div>
            </FeatureCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={200}>
            <FeatureCard
              icon={<IconLink className="size-5" />}
              title="Отправка ссылкой"
              desc="Уникальная ссылка на документ. Клиент открывает и скачивает без входа."
            >
              <div className="flex items-center gap-2 rounded-field bg-sunken px-3 py-2 font-mono text-xs text-muted">
                <IconLink className="size-3.5 shrink-0 text-faint" />
                <span className="truncate">docsify.kz/p/7K2M…</span>
              </div>
            </FeatureCard>
          </Reveal>

          <Reveal className="md:col-span-4" delay={240}>
            <FeatureCard
              icon={<IconWallet className="size-5" />}
              title="Дашборд оплат"
              desc="Главный экран отвечает на один вопрос: сколько мне должны прямо сейчас? Ожидает, просрочено, оплачено за месяц - на виду."
            >
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Ожидает" value="1 250 000 ₸" accent />
                <MiniStat label="Просрочено" value="320 000 ₸" danger />
                <MiniStat label="За июнь" value="980 000 ₸" />
              </div>
            </FeatureCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="group flex h-full flex-col rounded-card border border-line bg-sheet p-5 shadow-soft transition-transform duration-300 hover:-translate-y-1">
      <span className="inline-flex size-10 items-center justify-center rounded-field bg-tenge-tint text-tenge-ink">
        {icon}
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function KgdMini() {
  return (
    <div className="space-y-2 rounded-card border border-line-soft bg-paper/60 p-3">
      <div>
        <div className="mb-1 text-[11px] text-faint">БИН / ИИН</div>
        <div className="flex items-center gap-2 rounded-field bg-sunken px-3 py-2 font-mono text-sm tracking-wider">
          110240013813
          <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-tenge-tint px-2 py-0.5 font-sans text-[11px] font-medium text-tenge-ink">
            ✓ Реестр КГД
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MiniField label="Название" value="ТОО «PHYTO-APIPHARM»" wide />
        <MiniField label="Директор" value="Жаскалиева Г. И." />
      </div>
    </div>
  );
}

function MiniField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-field bg-sheet px-3 py-2", wide && "sm:col-span-2")}>
      <div className="text-[11px] text-faint">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function ClientsMini() {
  return (
    <div className="space-y-1.5">
      {["ТОО «PHYTO-APIPHARM»", "ИП Ескендиров", "ТОО «Каратау Строй»"].map((n) => (
        <div
          key={n}
          className="flex items-center gap-2 rounded-field border border-line-soft bg-paper/60 px-2.5 py-1.5 text-sm"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-tenge-tint text-[10px] font-semibold text-tenge-ink">
            {n.replace(/[«»]/g, "").trim()[0]}
          </span>
          <span className="truncate">{n}</span>
        </div>
      ))}
    </div>
  );
}

function DocChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-field border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-tenge/30 bg-tenge-tint text-tenge-ink"
          : "border-line bg-paper text-muted"
      )}
    >
      <IconDoc className="size-3.5" />
      {label}
    </span>
  );
}

function FormatChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-field border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink">
      <IconDownload className="size-3.5 text-faint" />
      {label}
    </span>
  );
}

function MiniStat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-field border bg-paper/60 p-2.5",
        accent ? "border-tenge/25" : danger ? "border-late/25" : "border-line-soft"
      )}
    >
      <div className="text-[11px] text-faint">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          accent ? "text-tenge-ink" : danger ? "text-late-ink" : "text-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- dashboard preview */

type ShowDoc = {
  client: string;
  type: string;
  number: string;
  date: string;
  amount: string;
  status: keyof typeof STATUS;
};

function DashboardShowcase() {
  const docs: ShowDoc[] = [
    { client: "ТОО «PHYTO-APIPHARM»", type: "Счёт", number: "СФ-2026-014", date: "10.06.2026", amount: "600 000 ₸", status: "sent" },
    { client: "ИП Ескендиров", type: "Акт", number: "АВР-2026-007", date: "08.06.2026", amount: "320 000 ₸", status: "signed" },
    { client: "ТОО «Каратау Строй»", type: "Счёт", number: "СФ-2026-013", date: "01.06.2026", amount: "980 000 ₸", status: "paid" },
  ];
  return (
    <section id="dashboard" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <SectionEyebrow>Дашборд</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              «Сколько мне должны прямо сейчас?»
            </h2>
            <p className="mt-3 text-lg text-muted">
              Главный экран отвечает сразу. Три суммы сверху, список документов со
              статусами - и никаких таблиц, в которых легко утонуть.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Ожидает оплаты - всё, что отправлено и ещё не оплачено",
                "Просрочено - счета старше 14 дней, чтобы вовремя напомнить",
                "Оплачено за месяц - сколько уже пришло",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <IconCheck className="mt-0.5 size-4 shrink-0 text-tenge" />
                  <span className="text-muted">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-sheet border border-line bg-sheet p-4 shadow-sheet sm:p-5">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <DashCard label="Ожидает оплаты" value="1 250 000 ₸" accent />
                <DashCard label="Просрочено" value="320 000 ₸" danger />
                <DashCard label="Оплачено за июнь" value="980 000 ₸" />
              </div>

              <div className="mt-3 overflow-hidden rounded-card border border-line">
                {docs.map((d, i) => (
                  <div
                    key={d.number}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-sheet px-3.5 py-3 sm:px-4",
                      i > 0 && "border-t border-line-soft"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{d.client}</span>
                        <StatusPill status={d.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-faint">
                        {d.type} {d.number} · {d.date}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold tabular-nums">
                      {d.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function DashCard({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-sheet p-3 shadow-soft sm:p-4",
        accent ? "border-tenge/25" : danger ? "border-late/25" : "border-line"
      )}
    >
      <div className="text-[11px] text-faint sm:text-xs">{label}</div>
      <div
        className={cn(
          "mt-1 text-base font-bold tracking-tight tabular-nums sm:text-xl",
          accent ? "text-tenge-ink" : danger ? "text-late-ink" : "text-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- philosophy */

function Philosophy() {
  const swaps: Array<[string, string]> = [
    ["Создать ЮЗЭДО маршрут", "Отправить счёт"],
    ["Статус легитимации", "Ожидает оплаты"],
    ["Контрагент", "Клиент"],
  ];
  return (
    <section className="border-t border-line-soft bg-sheet/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <SectionEyebrow>Подход</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Без жаргона ЭДО. По-человечески.
            </h2>
            <p className="mt-3 text-lg text-muted">
              Вы занимаетесь делом, а не изучаете термины из госпорталов. Поэтому
              в docsify всё названо так, как вы говорите сами.
            </p>
            <div className="mt-6 inline-flex flex-wrap gap-2">
              <RoadmapPill>Скоро - электронная подпись</RoadmapPill>
              <RoadmapPill>Скоро - автонапоминания</RoadmapPill>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-2.5">
              {swaps.map(([bad, good]) => (
                <div
                  key={good}
                  className="flex items-center gap-3 rounded-card border border-line bg-sheet p-3.5 shadow-soft sm:gap-4 sm:p-4"
                >
                  <span className="flex-1 text-sm text-ghost line-through decoration-danger/40">
                    {bad}
                  </span>
                  <IconArrowRight className="size-4 shrink-0 text-faint" />
                  <span className="flex-1 text-right text-sm font-semibold text-tenge-ink sm:text-base">
                    {good}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function RoadmapPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1 text-xs font-medium text-muted">
      <span className="size-1.5 rounded-full bg-tenge/60" />
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-sheet border border-line bg-sheet px-6 py-14 text-center shadow-sheet sm:px-10 sm:py-20">
          {/* warm tenge wash + soft glow, same vibe as the hero */}
          <div className="pointer-events-none absolute inset-0 bg-tenge-tint/35" />
          <div className="lp-aurora pointer-events-none absolute inset-0" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-wider text-tenge-ink shadow-soft">
              <span className="size-1.5 rounded-full bg-tenge" />
              Готовы начать?
            </div>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Выставите первый счёт{" "}
              <span className="text-tenge-ink">за пару минут.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted">
              Зарегистрируйтесь, добавьте свой БИН один раз - и отправьте клиенту
              документ, который выглядит официально и не теряется.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-field bg-tenge px-6 py-3 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
              >
                Создать аккаунт
                <IconArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-field border border-line bg-sheet px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-sunken"
              >
                У меня уже есть аккаунт
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-3 text-sm text-muted">
              Счета и акты для ИП и ТОО в Казахстане. От «работа сделана» до
              «счёт отправлен» - за пару минут.
            </p>
          </div>
          <div className="flex gap-12 text-sm">
            <FooterCol title="Продукт">
              <FooterLink href="#how">Как это работает</FooterLink>
              <FooterLink href="#features">Возможности</FooterLink>
              <FooterLink href="#dashboard">Дашборд</FooterLink>
            </FooterCol>
            <FooterCol title="Аккаунт">
              <FooterLink href="/login">Войти</FooterLink>
              <FooterLink href="/signup">Создать аккаунт</FooterLink>
            </FooterCol>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line-soft pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 docsify</span>
          <span>Формы по приказу Минфина РК № 562 · Сделано для бизнеса в Казахстане</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const Cmp = href.startsWith("#") ? "a" : Link;
  return (
    <Cmp href={href} className="text-muted transition-colors hover:text-ink">
      {children}
    </Cmp>
  );
}

/* ------------------------------------------------------------- shared bits */

function SectionEyebrow({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border border-line bg-sheet px-3 py-1 text-xs font-semibold uppercase tracking-wider text-tenge-ink shadow-soft",
        center && "mx-auto"
      )}
    >
      <span className="size-1.5 rounded-full bg-tenge" />
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS }) {
  const st = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-pill border px-2 py-0.5 text-xs font-medium",
        st.cls
      )}
    >
      {st.label}
    </span>
  );
}

/* -------------------------------------------------------------------- icons */
/* 24-grid, currentColor - matching the app's existing icon language. */

type IconProps = { className?: string };

function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
function IconArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  );
}
function IconDoc({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h6.5L19 9v11.5H7z" />
      <path d="M13 3.5V9h5M9.5 13h7M9.5 16.5h7" />
    </svg>
  );
}
function IconLink({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.5 6.8" />
      <path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 1 0 5.7 5.7L12.5 17.2" />
    </svg>
  );
}
function IconWallet({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" />
      <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 9H6.5A2.5 2.5 0 0 1 4 7.5Z" />
      <circle cx="16.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconStamp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4.5a3 3 0 0 1 6 0c0 1.6-1.2 2.4-1.5 3.8-.2 1 .3 1.7 1.3 1.7h.7a3 3 0 0 1 3 3V15H5.5v-2a3 3 0 0 1 3-3h.7c1 0 1.5-.7 1.3-1.7C10.2 6.9 9 6.1 9 4.5Z" />
      <path d="M4.5 19h15" />
    </svg>
  );
}
function IconDownload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}
function IconKeyboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h0M11 10h0M15 10h0M7 13.5h10" />
    </svg>
  );
}
function IconChat({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8A1.5 1.5 0 0 1 19 16.5H9.5L5.5 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
    </svg>
  );
}
function IconEye({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}
function IconPhone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 4.5 4.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A15 15 0 0 1 4 5.7 2 2 0 0 1 6 3.5Z" />
    </svg>
  );
}
