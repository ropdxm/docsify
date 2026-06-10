import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoiceDocument, type PdfDoc } from "@/lib/pdf/invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const element = React.createElement(InvoiceDocument, {
    doc: doc as unknown as PdfDoc,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

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
      "Content-Disposition": `inline; filename="document.pdf"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
