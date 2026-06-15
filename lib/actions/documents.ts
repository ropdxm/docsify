"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/dal";

const Item = z.object({
  description: z.string().default(""),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  // АВР only: единица измерения (шт, услуга, час…). Ignored for invoices.
  unit: z.string().optional(),
});

const CreateSchema = z.object({
  type: z.enum(["invoice", "avr", "nakladnaja"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  client: z.object({
    bin: z.string().regex(/^\d{12}$/),
    name: z.string().min(1),
    director: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  }),
  items: z.array(Item).min(1),
  bankProfileId: z.uuid().nullable().optional(),
  // АВР only: «Договор (контракт)» reference, e.g. "№ 12 от 01.06.2026".
  contract: z.string().optional().nullable(),
});

export type CreateDocumentInput = z.infer<typeof CreateSchema>;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function shareToken(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export async function createDocument(
  input: CreateDocumentInput,
  mode: "draft" | "send"
): Promise<{ error: string } | void> {
  const company = await requireCompany();

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: "Проверьте поля документа" };
  const { type, date, client, items } = parsed.data;
  // Contract reference only applies to АВР; drop it for invoices.
  const contract = type === "avr" ? parsed.data.contract?.trim() || null : null;

  const supabase = await createClient();

  // The bank requisites this document is issued with. Chosen profile must
  // belong to the company; otherwise fall back to the primary one.
  let bankProfileId: string | null = null;
  if (parsed.data.bankProfileId) {
    const { data: bp } = await supabase
      .from("bank_profiles")
      .select("id")
      .eq("id", parsed.data.bankProfileId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!bp) return { error: "Выбранные банковские реквизиты не найдены" };
    bankProfileId = bp.id;
  } else {
    const { data: bp } = await supabase
      .from("bank_profiles")
      .select("id")
      .eq("company_id", company.id)
      .eq("is_primary", true)
      .maybeSingle();
    bankProfileId = bp?.id ?? null;
  }

  // Save / reuse the client.
  const { data: cp, error: cpError } = await supabase
    .from("counterparties")
    .upsert(
      {
        company_id: company.id,
        bin: client.bin,
        name: client.name,
        director: client.director || null,
        address: client.address || null,
      },
      { onConflict: "company_id,bin" }
    )
    .select("id")
    .single();
  if (cpError) return { error: `Не удалось сохранить клиента: ${cpError.message}` };

  // Per-company, per-year sequence number.
  const year = Number(date.slice(0, 4));
  const prefix = { invoice: "СФ", avr: "АВР", nakladnaja: "Накл" }[type];
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("type", type)
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);
  const number = `${prefix}-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const totalAmount = items.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0
  );

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      company_id: company.id,
      counterparty_id: cp.id,
      type,
      number,
      date,
      items,
      total_amount: totalAmount,
      status: mode === "send" ? "sent" : "draft",
      share_token: shareToken(),
      bank_profile_id: bankProfileId,
      contract,
    })
    .select("id")
    .single();
  if (error) return { error: `Не удалось создать документ: ${error.message}` };

  redirect(`/dashboard?created=${doc.id}`);
}

/**
 * Edit an existing document (e.g. a saved draft). Number and share token are
 * preserved. On mode "send" the status moves to "sent"; on "draft" the current
 * status is kept (so a draft stays a draft, a sent doc stays sent).
 */
export async function updateDocument(
  id: string,
  input: CreateDocumentInput,
  mode: "draft" | "send"
): Promise<{ error: string } | void> {
  const company = await requireCompany();

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: "Проверьте поля документа" };
  const { type, date, client, items } = parsed.data;
  const contract = type === "avr" ? parsed.data.contract?.trim() || null : null;

  const supabase = await createClient();

  // The document must belong to this company.
  const { data: existing } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { error: "Документ не найден" };
  // Only drafts can be edited. Once a document is sent/signed/paid it is locked
  // and view-only — reject any attempt to change it, even if the UI is bypassed.
  if (existing.status !== "draft") {
    return { error: "Документ уже отправлен — его можно только просматривать." };
  }

  // Resolve the bank profile (chosen, else primary fallback) — same as create.
  let bankProfileId: string | null = null;
  if (parsed.data.bankProfileId) {
    const { data: bp } = await supabase
      .from("bank_profiles")
      .select("id")
      .eq("id", parsed.data.bankProfileId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!bp) return { error: "Выбранные банковские реквизиты не найдены" };
    bankProfileId = bp.id;
  } else {
    const { data: bp } = await supabase
      .from("bank_profiles")
      .select("id")
      .eq("company_id", company.id)
      .eq("is_primary", true)
      .maybeSingle();
    bankProfileId = bp?.id ?? null;
  }

  const { data: cp, error: cpError } = await supabase
    .from("counterparties")
    .upsert(
      {
        company_id: company.id,
        bin: client.bin,
        name: client.name,
        director: client.director || null,
        address: client.address || null,
      },
      { onConflict: "company_id,bin" }
    )
    .select("id")
    .single();
  if (cpError) return { error: `Не удалось сохранить клиента: ${cpError.message}` };

  const totalAmount = items.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0
  );

  const updates: Record<string, unknown> = {
    counterparty_id: cp.id,
    type,
    date,
    items,
    total_amount: totalAmount,
    bank_profile_id: bankProfileId,
    contract,
  };
  if (mode === "send") updates.status = "sent";

  const { error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .eq("company_id", company.id);
  if (error) return { error: `Не удалось сохранить документ: ${error.message}` };

  revalidatePath("/dashboard");
  redirect("/dashboard?updated=1");
}

export async function markDocumentPaid(id: string, _formData: FormData) {
  const company = await requireCompany();
  const supabase = await createClient();
  await supabase
    .from("documents")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", company.id);
  revalidatePath("/dashboard");
}
