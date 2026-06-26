"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompany } from "@/lib/dal";
import {
  documentQuotaMessageFromError,
} from "@/lib/document-quota-shared";
import { getDocumentQuotaError } from "@/lib/document-quotas";
import { verifyCms, sameBin } from "@/lib/nca/verify";
import type { SupabaseClient } from "@supabase/supabase-js";

const PDF_MIME = "application/pdf";
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function shareToken(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Create a договор from an uploaded PDF. The signable PDF lands in the private
 * 'documents' bucket; both parties sign it later with ЭЦП. Returns an error, or
 * redirects to the detail page on success.
 */
export async function createDogovor(
  form: FormData
): Promise<{ error: string } | void> {
  const company = await requireCompany();

  const title = str(form, "title");
  const isoDate = str(form, "date");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? isoDate
    : new Date().toISOString().slice(0, 10);

  const client = {
    bin: str(form, "clientBin"),
    name: str(form, "clientName"),
    director: str(form, "clientDirector"),
    address: str(form, "clientAddress"),
  };
  if (!/^\d{12}$/.test(client.bin) || !client.name) {
    return { error: "Выберите клиента (нужны название и БИН/ИИН)." };
  }
  const quotaError = await getDocumentQuotaError(company.id, "dogovor");
  if (quotaError) return { error: quotaError };

  // Resolve the uploaded PDF up front so we don't insert a row we can't fill.
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Прикрепите PDF-файл договора." };
  }
  if (file.type && file.type !== PDF_MIME) {
    return { error: "Поддерживается только PDF. Экспортируйте договор в PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "Файл слишком большой (макс. 15 МБ)." };
  }
  const pdf = Buffer.from(await file.arrayBuffer());

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
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("type", "dogovor")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);
  const number = `ДОГ-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      company_id: company.id,
      counterparty_id: cp.id,
      type: "dogovor",
      number,
      date,
      title: title || null,
      body: null,
      status: "draft",
      share_token: shareToken(),
    })
    .select("id")
    .single();
  if (error) {
    const quotaMessage = documentQuotaMessageFromError(error.message);
    return { error: quotaMessage ?? `Не удалось создать договор: ${error.message}` };
  }

  // Store the signable PDF (service role - the bucket is private).
  const filePath = `${company.id}/${doc.id}/dogovor.pdf`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(filePath, pdf, { contentType: PDF_MIME, upsert: true });
  if (upErr) return { error: `Не удалось сохранить файл: ${upErr.message}` };

  await supabase
    .from("documents")
    .update({ file_path: filePath })
    .eq("id", doc.id);

  revalidatePath("/dashboard");
  redirect(`/documents/${doc.id}`);
}

/* ------------------------------------------------------------- signing -- */

type SignResult = { ok: true } | { error: string };

async function pdfBase64(
  admin: SupabaseClient,
  filePath: string
): Promise<string> {
  const { data, error } = await admin.storage
    .from("documents")
    .download(filePath);
  if (error || !data) throw new Error("Файл договора не найден");
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

/**
 * Store the owner's ЭЦП signature on a договор. The signature is verified by
 * NCANode and the signer's ИИН/БИН must match the company's. On success the
 * договор becomes 'sent' (the client can now sign it).
 */
export async function signDogovorAsOwner(
  documentId: string,
  cms: string
): Promise<SignResult> {
  const company = await requireCompany();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, type, file_path")
    .eq("id", documentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!doc || doc.type !== "dogovor" || !doc.file_path) {
    return { error: "Договор не найден." };
  }

  const admin = createAdminClient();
  let data: string;
  try {
    data = await pdfBase64(admin, doc.file_path);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let v;
  try {
    v = await verifyCms(cms, data);
  } catch (e) {
    return { error: `Проверка подписи недоступна: ${(e as Error).message}` };
  }
  if (!v.valid) return { error: "Подпись недействительна или отозвана." };
  if (!sameBin(v.signerBin, company.bin)) {
    return {
      error: `ЭЦП оформлена на другой БИН/ИИН (${v.signerBin ?? "-"}). Подпишите ключом вашей организации.`,
    };
  }

  const { error } = await admin.from("document_signatures").upsert(
    {
      document_id: doc.id,
      signer_role: "owner",
      signer_bin: v.signerBin,
      signer_name: v.signerName,
      cms,
      is_valid: true,
      verification: v.raw,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "document_id,signer_role" }
  );
  if (error) return { error: `Не удалось сохранить подпись: ${error.message}` };

  await admin.from("documents").update({ status: "sent" }).eq("id", doc.id);
  revalidatePath(`/documents/${doc.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Store the client's ЭЦП signature via the public share link. The signer's
 * ИИН/БИН must match the counterparty's. Requires the owner to have signed
 * first (status 'sent'); on success the договор becomes 'signed'.
 */
export async function signDogovorAsClient(
  shareToken: string,
  cms: string
): Promise<SignResult> {
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("id, type, file_path, status, counterparty:counterparties(bin)")
    .eq("share_token", shareToken)
    .maybeSingle();
  if (!doc || doc.type !== "dogovor" || !doc.file_path) {
    return { error: "Договор не найден." };
  }
  if (doc.status !== "sent") {
    return { error: "Договор ещё не подписан исполнителем." };
  }
  const cp = Array.isArray(doc.counterparty)
    ? doc.counterparty[0]
    : doc.counterparty;

  let data: string;
  try {
    data = await pdfBase64(admin, doc.file_path);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let v;
  try {
    v = await verifyCms(cms, data);
  } catch (e) {
    return { error: `Проверка подписи недоступна: ${(e as Error).message}` };
  }
  if (!v.valid) return { error: "Подпись недействительна или отозвана." };
  if (cp?.bin && !sameBin(v.signerBin, cp.bin)) {
    return {
      error: `ЭЦП оформлена на другой БИН/ИИН (${v.signerBin ?? "-"}). Подпишите ключом вашей организации.`,
    };
  }

  const { error } = await admin.from("document_signatures").upsert(
    {
      document_id: doc.id,
      signer_role: "client",
      signer_bin: v.signerBin,
      signer_name: v.signerName,
      cms,
      is_valid: true,
      verification: v.raw,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "document_id,signer_role" }
  );
  if (error) return { error: `Не удалось сохранить подпись: ${error.message}` };

  await admin.from("documents").update({ status: "signed" }).eq("id", doc.id);
  revalidatePath(`/p/${shareToken}`);
  return { ok: true };
}
