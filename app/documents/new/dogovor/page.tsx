import Link from "next/link";
import { getCompany, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { DogovorForm } from "./dogovor-form";
import type { SavedClient } from "../document-form";

export default async function NewDogovorPage() {
  await requireUser();
  const company = await getCompany();

  if (!company) {
    return <MissingRequisitesModal next="/documents/new/dogovor" />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("counterparties")
    .select("id, bin, name, director, address")
    .eq("company_id", company.id)
    .order("name");
  const clients = (data ?? []) as SavedClient[];

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="docsify" className="flex items-center">
            <BrandLogo className="size-8" />
          </Link>
          <Link
            href="/dashboard"
            className="-mr-1 inline-flex size-9 items-center justify-center rounded-field text-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-6 sm:pt-10">
        <div className="mb-5 px-1 sm:mb-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Новый договор
          </h1>
          <p className="mt-1 text-sm text-muted">
            Напишите или загрузите договор. Затем подпишите его ЭЦП и отправьте
            клиенту на подпись.
          </p>
        </div>
        <DogovorForm
          company={{ name: company.name, bin: company.bin }}
          clients={clients}
        />
      </main>
    </div>
  );
}

function MissingRequisitesModal({ next }: { next: string }) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="docsify" className="flex items-center">
            <BrandLogo className="size-8" />
          </Link>
          <Link
            href="/dashboard"
            className="-mr-1 inline-flex size-9 items-center justify-center rounded-field text-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-6 sm:pt-10">
        <div className="mb-5 px-1 sm:mb-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Новый договор
          </h1>
          <p className="mt-1 text-sm text-muted">
            Сначала добавим данные, которые попадут в ваши документы.
          </p>
        </div>
      </main>

      <div className="fixed inset-0 z-40 grid place-items-center bg-paper/80 px-4 py-8">
        <div className="max-h-full w-full max-w-lg overflow-auto rounded-sheet border border-line bg-sheet p-5 shadow-pop sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight">
              Заполните реквизиты
            </h2>
            <p className="mt-1 text-sm text-muted">
              Укажите БИН/ИИН, данные компании и банковские реквизиты. После
              сохранения вернём вас к созданию договора.
            </p>
          </div>
          <OnboardingForm next={next} />
        </div>
      </div>
    </div>
  );
}
