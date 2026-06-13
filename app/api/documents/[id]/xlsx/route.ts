import { renderInvoiceXlsx, type XlsxDoc } from "@/lib/xlsx/invoice";
import { renderAvrXlsx } from "@/lib/xlsx/avr";
import { renderNakladnajaXlsx } from "@/lib/xlsx/nakladnaja";
import { bankForDocument } from "@/lib/bank";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

  const bank = await bankForDocument(admin, doc);
  const payload = { ...doc, bank } as unknown as XlsxDoc;
  const buffer =
    doc.type === "avr"
      ? await renderAvrXlsx(payload)
      : doc.type === "nakladnaja"
        ? await renderNakladnajaXlsx(payload)
        : await renderInvoiceXlsx(payload);

  // Store the filled form (best-effort).
  const filePath = `${doc.company_id}/${doc.id}.xlsx`;
  await admin.storage
    .from("documents")
    .upload(filePath, buffer, { contentType: XLSX_MIME, upsert: true });
  if (doc.pdf_path !== filePath) {
    await admin.from("documents").update({ pdf_path: filePath }).eq("id", doc.id);
  }

  const filename = `${encodeURIComponent(doc.number)}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="document.xlsx"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
