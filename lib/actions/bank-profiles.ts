"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/dal";
import { BankRequisites, fieldErrorsOf } from "@/lib/schemas";

export type BankProfileState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

const NewProfile = BankRequisites.extend({
  label: z.string().trim().max(60, "Слишком длинное название").optional(),
});

export async function createBankProfile(
  _prev: BankProfileState,
  formData: FormData
): Promise<BankProfileState> {
  const company = await requireCompany();
  const parsed = NewProfile.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { label, iik, bank_name, bik, kbe, knp } = parsed.data;

  const supabase = await createClient();
  const { count } = await supabase
    .from("bank_profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id);

  const { error } = await supabase.from("bank_profiles").insert({
    company_id: company.id,
    label: label || "",
    iik,
    bank_name,
    bik,
    kbe,
    knp: knp || null,
    is_primary: (count ?? 0) === 0, // the first profile becomes the default
  });
  if (error) return { error: `Не удалось сохранить реквизиты: ${error.message}` };

  revalidatePath("/profile");
  revalidatePath("/documents/new");
  return { ok: true };
}

export async function setPrimaryBankProfile(id: string, _formData: FormData) {
  const company = await requireCompany();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("bank_profiles")
    .select("id")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!target) return;

  // Unset the old primary first - a partial unique index allows only one.
  await supabase
    .from("bank_profiles")
    .update({ is_primary: false })
    .eq("company_id", company.id)
    .eq("is_primary", true);
  await supabase
    .from("bank_profiles")
    .update({ is_primary: true })
    .eq("id", target.id);

  revalidatePath("/profile");
  revalidatePath("/documents/new");
}

export async function deleteBankProfile(id: string, _formData: FormData) {
  const company = await requireCompany();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("bank_profiles")
    .select("id, is_primary")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!target) return;

  await supabase.from("bank_profiles").delete().eq("id", target.id);

  // Keep exactly one primary: promote the oldest remaining profile.
  if (target.is_primary) {
    const { data: next } = await supabase
      .from("bank_profiles")
      .select("id")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("bank_profiles")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  revalidatePath("/profile");
  revalidatePath("/documents/new");
}
