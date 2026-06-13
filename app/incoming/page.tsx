import { requireCompany } from "@/lib/dal";
import { getIncomingDogovors } from "@/lib/incoming";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { IncomingList } from "@/components/incoming-list";

export default async function IncomingPage() {
  const company = await requireCompany();
  const incoming = await getIncomingDogovors(company);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        companyName={company.name}
        active="incoming"
        incomingCount={incoming.length}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Входящие
          </h1>
          <p className="mt-1 text-sm text-muted">
            Договоры, которые вам отправили на подпись. Откройте, чтобы
            ознакомиться и подписать своей ЭЦП.
          </p>
        </div>

        <div className="mt-8">
          {incoming.length === 0 ? (
            <div className="rounded-sheet border border-dashed border-line-strong bg-sheet p-10 text-center">
              <p className="font-medium">Пока ничего не пришло</p>
              <p className="mt-1 text-sm text-muted">
                Когда контрагент отправит вам договор на подпись, он появится
                здесь. Договоры находят вас по вашему БИН/ИИН&nbsp;
                <span className="font-mono">{company.bin}</span>.
              </p>
            </div>
          ) : (
            <IncomingList items={incoming} />
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
