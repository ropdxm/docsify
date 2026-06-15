import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompany, getBankProfiles } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  DocumentForm,
  type SavedClient,
  type DocumentInitial,
} from "../../new/document-form";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await requireCompany();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("*, counterparty:counterparties(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!doc) notFound();
  // Договоры are signed (not edited here), and only drafts are editable. A
  // sent/signed/paid document is view-only — send it to its detail page.
  if (doc.type === "dogovor" || doc.status !== "draft") {
    redirect(`/documents/${id}`);
  }

  // The user's saved clients — searchable in the form.
  const { data: clientsData } = await supabase
    .from("counterparties")
    .select("id, bin, name, director, address")
    .eq("company_id", company.id)
    .order("name");
  const clients = (clientsData ?? []) as SavedClient[];

  const bankProfiles = (await getBankProfiles(company.id)).map((p) => ({
    id: p.id,
    label: p.label,
    bank_name: p.bank_name,
    iik: p.iik,
    is_primary: p.is_primary,
  }));

  // Previously-used units, for the "ед. изм." suggestions.
  const { data: unitRows } = await supabase
    .from("documents")
    .select("items")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const seen = new Set<string>();
  const unitOptions: string[] = [];
  for (const row of unitRows ?? []) {
    const its = (row.items ?? []) as Array<{ unit?: string | null }>;
    for (const it of its) {
      const u = (it?.unit ?? "").trim();
      if (u && !seen.has(u)) {
        seen.add(u);
        unitOptions.push(u);
      }
    }
  }

  const cp = Array.isArray(doc.counterparty)
    ? doc.counterparty[0]
    : doc.counterparty;

  const initial: DocumentInitial = {
    type: doc.type,
    status: doc.status,
    number: doc.number,
    date: doc.date,
    client: {
      bin: cp?.bin ?? "",
      name: cp?.name ?? "",
      director: cp?.director ?? "",
      address: cp?.address ?? "",
    },
    items: (doc.items ?? []) as DocumentInitial["items"],
    contract: doc.contract ?? null,
    bankProfileId: doc.bank_profile_id ?? null,
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-tenge" />
            <span className="font-semibold tracking-tight">docsify</span>
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
            Редактировать документ
          </h1>
          <p className="mt-1 text-sm text-muted">
            {doc.number} — изменения сохранятся в этот же документ.
          </p>
        </div>
        <DocumentForm
          company={{ name: company.name, bin: company.bin }}
          clients={clients}
          bankProfiles={bankProfiles}
          unitOptions={unitOptions}
          documentId={doc.id}
          initial={initial}
        />
      </main>
    </div>
  );
}
