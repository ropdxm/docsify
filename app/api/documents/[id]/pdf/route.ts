import { convertExcelToPdf } from "@/lib/libreoffice/excel-to-pdf";
import { bankForDocument } from "@/lib/bank";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderDocumentXlsx } from "@/lib/xlsx/render";
import type { XlsxDoc } from "@/lib/xlsx/invoice";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("*, company:companies(*), counterparty:counterparties(*)")
    .eq("id", id)
    .maybeSingle();

  if (!doc) return new Response("Документ не найден", { status: 404 });

  // Access: a valid share token (public link) OR the authenticated owner.
  let allowed = token != null && token === doc.share_token;
  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    allowed = !!user && user.id === doc.company?.owner_id;
  }
  if (!allowed) return new Response("Нет доступа", { status: 403 });

  if (!["invoice", "avr", "nakladnaja"].includes(doc.type)) {
    return new Response("Этот тип документа нельзя преобразовать из Excel", {
      status: 400,
    });
  }

  const bank = await bankForDocument(admin, doc);
  const payload = { ...doc, bank } as unknown as XlsxDoc;

  let buffer: Buffer;
  try {
    const xlsx = await renderDocumentXlsx(payload);
    buffer = await convertExcelToPdf(xlsx);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Excel-to-PDF conversion failed",
        documentId: doc.id,
        documentType: doc.type,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return new Response("Не удалось преобразовать Excel в PDF", {
      status: 500,
    });
  }

  // Store the PDF (best-effort) so it has a stable home in Storage.
  const pdfPath = `${doc.company_id}/${doc.id}.pdf`;
  await admin.storage
    .from("documents")
    .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
  if (doc.pdf_path !== pdfPath) {
    await admin.from("documents").update({ pdf_path: pdfPath }).eq("id", doc.id);
  }

  const filename = `${encodeURIComponent(doc.number)}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
