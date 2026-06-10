import Link from "next/link";
import { AuthShell, OrDivider } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Укажите реквизиты вашей компании — они пойдут в каждый документ."
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
      <OrDivider />
      <GoogleButton next="/dashboard" />
    </AuthShell>
  );
}
