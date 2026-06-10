import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/dal";
import { btnPrimary, btnGhost, cn } from "@/lib/ui";

export default async function Home() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-3 rounded-full bg-tenge" />
        <span className="text-lg font-semibold tracking-tight">
          Быстрые деньги
        </span>
      </div>
      <h1 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl">
        От «работа сделана» до «счёт отправлен» — за пару минут.
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Счета и акты для ИП и ТОО. Сохраните клиентов один раз и переиспользуйте.
        Отправьте клиенту ссылкой и следите за оплатой.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link href="/signup" className={cn(btnPrimary, "px-6 py-3")}>
          Создать аккаунт
        </Link>
        <Link href="/login" className={cn(btnGhost, "px-6 py-3")}>
          Войти
        </Link>
      </div>
    </div>
  );
}
