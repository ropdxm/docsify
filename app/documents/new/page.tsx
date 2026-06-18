import Link from "next/link";
import { getBankProfiles, getCompany, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { DocumentForm, type SavedClient } from "./document-form";

export default async function NewDocumentPage() {
  await requireUser();
  const company = await getCompany();

  if (!company) {
    return <MissingRequisitesModal next="/documents/new" />;
  }

  // The user's saved clients - searchable in the form, fetched from the DB.
  const supabase = await createClient();
  const { data } = await supabase
    .from("counterparties")
    .select("id, bin, name, director, address")
    .eq("company_id", company.id)
    .order("name");
  const clients = (data ?? []) as SavedClient[];

  // Units this company has typed before (АВР / накладная line items), so the
  // "ед. изм." field can offer them as suggestions. Most-recent documents first.
  const { data: unitRows } = await supabase
    .from("documents")
    .select("items")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const seen = new Set<string>();
  const unitOptions: string[] = [];
  for (const row of unitRows ?? []) {
    const items = (row.items ?? []) as Array<{ unit?: string | null }>;
    for (const it of items) {
      const u = (it?.unit ?? "").trim();
      if (u && !seen.has(u)) {
        seen.add(u);
        unitOptions.push(u);
      }
    }
  }

  const bankProfiles = (await getBankProfiles(company.id)).map((p) => ({
    id: p.id,
    label: p.label,
    bank_name: p.bank_name,
    iik: p.iik,
    is_primary: p.is_primary,
  }));

  return (
    <div className="min-h-full">
      {/* Grounding: where you are + a clear way out. Brand sits on the same warm
          paper as the canvas, separated only by a hairline - no "header world". */}
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
            Новый документ
          </h1>
          <p className="mt-1 text-sm text-muted">
            Заполните, и отправьте клиенту ссылкой - без печатей и Word.
          </p>
        </div>
        <DocumentForm
          company={{ name: company.name, bin: company.bin }}
          clients={clients}
          bankProfiles={bankProfiles}
          unitOptions={unitOptions}
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
            Новый документ
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
              сохранения вернём вас к созданию документа.
            </p>
          </div>
          <OnboardingForm next={next} />
        </div>
      </div>
    </div>
  );
}
