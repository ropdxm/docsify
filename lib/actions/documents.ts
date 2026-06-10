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
});

const CreateSchema = z.object({
  type: z.enum(["invoice", "avr"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  client: z.object({
    bin: z.string().regex(/^\d{12}$/),
    name: z.string().min(1),
    director: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  }),
  items: z.array(Item).min(1),
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

  const supabase = await createClient();

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
  const prefix = type === "invoice" ? "СФ" : "АВР";
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
    })
    .select("id")
    .single();
  if (error) return { error: `Не удалось создать документ: ${error.message}` };

  redirect(`/dashboard?created=${doc.id}`);
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
