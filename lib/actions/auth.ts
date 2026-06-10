"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/dal";

export type AuthState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

const Requisites = z.object({
  bin: z.string().regex(/^\d{12}$/, "БИН/ИИН: ровно 12 цифр"),
  name: z.string().min(2, "Укажите название компании"),
  director: z.string().optional(),
  address: z.string().optional(),
});

const SignupSchema = z
  .object({
    email: z.string().email("Введите корректный email"),
    password: z.string().min(8, "Пароль минимум 8 символов"),
  })
  .and(Requisites);

const LoginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

// Build field errors from issues directly — robust across zod versions.
function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

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
  const { email, password, bin, name, director, address } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: ru(error.message) };

  const userId = data.user?.id;
  if (!userId) return { error: "Не удалось создать аккаунт" };

  // Provision the company with the service role so it works regardless of
  // whether email confirmation is on.
  const admin = createAdminClient();
  const { error: companyError } = await admin.from("companies").insert({
    owner_id: userId,
    bin,
    name,
    director: director || null,
    address: address || null,
  });
  if (companyError && companyError.code !== "23505") {
    return {
      error: `Аккаунт создан, но реквизиты не сохранились: ${companyError.message}`,
    };
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
  const parsed = Requisites.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({
    owner_id: user.id,
    bin: parsed.data.bin,
    name: parsed.data.name,
    director: parsed.data.director || null,
    address: parsed.data.address || null,
  });
  if (error && error.code !== "23505") return { error: error.message };
  redirect("/dashboard");
}
