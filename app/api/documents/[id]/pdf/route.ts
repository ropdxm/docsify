import { createHash } from "node:crypto";
import { after } from "next/server";
import { convertExcelToPdf } from "@/lib/libreoffice/excel-to-pdf";
import { bankForDocument } from "@/lib/bank";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderDocumentXlsx } from "@/lib/xlsx/render";
import type { XlsxDoc } from "@/lib/xlsx/invoice";

export const runtime = "nodejs";
export const maxDuration = 300;

// Bump when the rendered layout changes (templates or lib/xlsx renderers) so
// PDFs cached in Storage regenerate instead of being served stale.
// v2: full-width print layout (phantom template columns hidden).
// v3: АВР/накладная centered vertically as well as horizontally.
const PDF_LAYOUT_VERSION = 3;

function pdfResponse(pdf: Uint8Array<ArrayBuffer>, number: string): Response {
  const filename = `${encodeURIComponent(number)}.pdf`;
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}

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

  // Owner's signature (PDF only - the downloadable Excel stays unsigned).
  // The versioned storage path doubles as the cache-invalidation key: a
  // re-uploaded signature gets a new path, a deleted one goes null.
  const signaturePath: string | null = doc.company?.signature_path ?? null;
  let signature: XlsxDoc["signature"] = null;
  if (signaturePath) {
    const file = await admin.storage.from("documents").download(signaturePath);
    if (file.data) {
      signature = {
        data: Buffer.from(await file.data.arrayBuffer()),
        extension: signaturePath.endsWith(".png") ? "png" : "jpeg",
      };
    } else {
      // A configured signature must not silently vanish from a business
      // document. A dangling path (object gone) degrades to unsigned - that
      // matches what the profile shows - but a transient storage error fails
      // the request so the client can retry and get the signed PDF.
      const message = file.error?.message ?? "unknown storage error";
      const missing = /not[ _-]?found/i.test(message);
      console.error(
        JSON.stringify({
          level: missing ? "warn" : "error",
          message: "signature download failed",
          documentId: doc.id,
          signaturePath,
          missing,
          error: message,
        })
      );
      if (!missing) {
        return new Response("Не удалось получить подпись - попробуйте ещё раз", {
          status: 500,
        });
      }
    }
  }

  const payload = { ...doc, bank, signature } as unknown as XlsxDoc;

  // The Storage path is keyed by everything the PDF renders, so any content
  // (or layout-version) change lands on a new path and a stale object can
  // never be served. Conversion boots LibreOffice WASM - the cache makes
  // repeat downloads instant and cold ones survivable.
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        v: PDF_LAYOUT_VERSION,
        signature: signature ? signaturePath : null,
        type: payload.type,
        number: payload.number,
        date: payload.date,
        items: payload.items,
        total_amount: payload.total_amount,
        contract: payload.contract ?? null,
        company: {
          name: payload.company.name,
          bin: payload.company.bin,
          director: payload.company.director ?? null,
          address: payload.company.address ?? null,
        },
        counterparty: payload.counterparty
          ? {
              name: payload.counterparty.name,
              bin: payload.counterparty.bin,
              director: payload.counterparty.director ?? null,
              address: payload.counterparty.address ?? null,
            }
          : null,
        bank,
      })
    )
    .digest("hex")
    .slice(0, 16);
  const pdfPath = `${doc.company_id}/${doc.id}-${contentHash}.pdf`;

  const cached = await admin.storage.from("documents").download(pdfPath);
  if (cached.data) {
    return pdfResponse(new Uint8Array(await cached.data.arrayBuffer()), doc.number);
  }

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

  // Persist the PDF for future downloads without making this one wait for it.
  after(async () => {
    try {
      const { error } = await admin.storage
        .from("documents")
        .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
      if (error) throw error;
      if (doc.pdf_path !== pdfPath) {
        await admin.from("documents").update({ pdf_path: pdfPath }).eq("id", doc.id);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          message: "PDF cache write failed - downloads will keep regenerating",
          documentId: doc.id,
          pdfPath,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  return pdfResponse(new Uint8Array(buffer), doc.number);
}
