import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Зарегистрируйтесь по email и паролю. Реквизиты попросим только перед первым документом."
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-tenge-ink">
            Войти
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
