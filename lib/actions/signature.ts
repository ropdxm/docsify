"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_SIGNATURE_BYTES,
  validateSignatureImage,
} from "@/lib/signature-image";

export type SignatureState = { ok?: boolean; error?: string } | undefined;

export async function uploadSignature(
  _prev: SignatureState,
  formData: FormData
): Promise<SignatureState> {
  const company = await requireCompany();

  const file = formData.get("signature");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл с изображением подписи" };
  }
  if (file.size > MAX_SIGNATURE_BYTES) {
    return { error: "Файл больше 1 МБ - сохраните подпись компактнее" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const image = validateSignatureImage(bytes);
  if (!image) {
    return {
      error:
        "Поддерживаются PNG и JPG размером до 4 МП (например, 2000×1000 px)",
    };
  }

  const admin = createAdminClient();
  // Random suffix on purpose: the path doubles as the PDF-cache invalidation
  // key, so a replaced signature must land on a new path.
  const path = `${company.id}/signature-${randomBytes(6).toString("hex")}.${image.extension}`;
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(path, bytes, { contentType: image.contentType });
  if (uploadError) {
    return { error: `Не удалось сохранить подпись: ${uploadError.message}` };
  }

  const { error: dbError } = await admin
    .from("companies")
    .update({ signature_path: path })
    .eq("id", company.id);
  if (dbError) {
    await admin.storage.from("documents").remove([path]);
    return { error: `Не удалось сохранить подпись: ${dbError.message}` };
  }

  // Best-effort cleanup of the replaced image.
  if (company.signature_path && company.signature_path !== path) {
    await admin.storage.from("documents").remove([company.signature_path]);
  }

  revalidatePath("/profile");
  return { ok: true };
}

// The (prev, formData) shape is required by useActionState even though the
// delete needs neither argument.
export async function deleteSignature(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: SignatureState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<SignatureState> {
  const company = await requireCompany();
  if (!company.signature_path) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ signature_path: null })
    .eq("id", company.id);
  if (error) {
    return { error: `Не удалось удалить подпись: ${error.message}` };
  }
  await admin.storage.from("documents").remove([company.signature_path]);
  revalidatePath("/profile");
  return { ok: true };
}
