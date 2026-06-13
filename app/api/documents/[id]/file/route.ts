import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Serves the договор PDF from the private 'documents' bucket. Access: a valid
// share token (public link) OR the authenticated owner.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("file_path, share_token, number, company:companies(owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (!doc?.file_path) return new Response("Файл не найден", { status: 404 });

  let allowed = token != null && token === doc.share_token;
  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const company = Array.isArray(doc.company) ? doc.company[0] : doc.company;
    allowed = !!user && user.id === company?.owner_id;
  }
  if (!allowed) return new Response("Нет доступа", { status: 403 });

  const { data: file, error } = await admin.storage
    .from("documents")
    .download(doc.file_path);
  if (error || !file) return new Response("Файл не найден", { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = `${encodeURIComponent(doc.number)}.pdf`;
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dogovor.pdf"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
