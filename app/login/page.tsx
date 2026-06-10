import Link from "next/link";
import { AuthShell, OrDivider } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const checkEmail = sp.check_email === "1";

  return (
    <AuthShell
      title="С возвращением"
      subtitle="Войдите, чтобы увидеть, кто вам должен."
      footer={
        <>
          Нет аккаунта?{" "}
          <Link href="/signup" className="font-medium text-tenge-ink">
            Создать
          </Link>
        </>
      }
    >
      {checkEmail && (
        <p className="mb-4 rounded-field bg-tenge-tint/60 p-3 text-sm text-tenge-ink">
          Аккаунт создан. Подтвердите email из письма, затем войдите.
        </p>
      )}
      <LoginForm next={next} />
      <OrDivider />
      <GoogleButton next={next || "/dashboard"} />
    </AuthShell>
  );
}
