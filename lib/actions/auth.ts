"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/dal";
import { Requisites, BankRequisites, fieldErrorsOf } from "@/lib/schemas";

export type AuthState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

const SignupSchema = z
  .object({
    email: z.string().email("Введите корректный email"),
    password: z.string().min(8, "Пароль минимум 8 символов"),
  })
  .and(Requisites)
  .and(BankRequisites);

const LoginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

function ru(message: string): string {
  if (/already registered|already exists/i.test(message))
    return "Этот email уже зарегистрирован";
  if (/invalid login credentials/i.test(message))
    return "Неверный email или пароль";
  return message;
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { email, password, bin, name, director, address, iik, bank_name, bik, kbe, knp } =
    parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: ru(error.message) };

  const userId = data.user?.id;
  if (!userId) return { error: "Не удалось создать аккаунт" };

  // Provision the company with the service role so it works regardless of
  // whether email confirmation is on.
  const admin = createAdminClient();
  const { data: companyRow, error: companyError } = await admin
    .from("companies")
    .insert({
      owner_id: userId,
      bin,
      name,
      director: director || null,
      address: address || null,
    })
    .select("id")
    .single();
  if (companyError && companyError.code !== "23505") {
    return {
      error: `Аккаунт создан, но реквизиты не сохранились: ${companyError.message}`,
    };
  }

  // The first bank profile becomes the primary one used on documents.
  if (companyRow) {
    const { error: bankError } = await admin.from("bank_profiles").insert({
      company_id: companyRow.id,
      iik,
      bank_name,
      bik,
      kbe,
      knp: knp || null,
      is_primary: true,
    });
    if (bankError && bankError.code !== "23505") {
      return {
        error: `Аккаунт создан, но банковские реквизиты не сохранились: ${bankError.message}`,
      };
    }
  }

  // If confirmation is disabled a session already exists; otherwise sign in.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) redirect("/login?check_email=1");
  }
  redirect("/dashboard");
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: ru(error.message) };

  const next = (formData.get("next") as string) || "/dashboard";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(safeNext);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Onboarding for users who signed in via OAuth and have no company yet. */
export async function createCompany(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const user = await requireUser();
  const parsed = Requisites.and(BankRequisites).safeParse(
    Object.fromEntries(formData)
  );
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { bin, name, director, address, iik, bank_name, bik, kbe, knp } =
    parsed.data;
  const supabase = await createClient();
  const { data: companyRow, error } = await supabase
    .from("companies")
    .insert({
      owner_id: user.id,
      bin,
      name,
      director: director || null,
      address: address || null,
    })
    .select("id")
    .single();
  if (error && error.code !== "23505") return { error: error.message };

  if (companyRow) {
    const { error: bankError } = await supabase.from("bank_profiles").insert({
      company_id: companyRow.id,
      iik,
      bank_name,
      bik,
      kbe,
      knp: knp || null,
      is_primary: true,
    });
    if (bankError && bankError.code !== "23505") {
      return { error: `Банковские реквизиты не сохранились: ${bankError.message}` };
    }
  }
  redirect("/dashboard");
}
