import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { requireUser, getCompany } from "@/lib/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  const company = await getCompany();
  if (company) redirect("/dashboard");

  return (
    <AuthShell
      title="Ещё пара деталей"
      subtitle="Укажите реквизиты вашей компании — они пойдут в каждый документ."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
