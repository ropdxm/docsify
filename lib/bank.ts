import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DocBank = {
  iik: string;
  bank_name: string;
  bik: string;
  kbe: string;
  knp: string | null;
};

/**
 * The bank requisites a document should print: the profile chosen at
 * creation, or the company's current primary as a fallback (legacy docs,
 * deleted profiles). Null when the company has no profiles at all.
 */
export async function bankForDocument(
  admin: SupabaseClient,
  doc: { company_id: string; bank_profile_id?: string | null }
): Promise<DocBank | null> {
  const fields = "iik, bank_name, bik, kbe, knp";
  if (doc.bank_profile_id) {
    const { data } = await admin
      .from("bank_profiles")
      .select(fields)
      .eq("id", doc.bank_profile_id)
      .maybeSingle();
    if (data) return data as DocBank;
  }
  const { data } = await admin
    .from("bank_profiles")
    .select(fields)
    .eq("company_id", doc.company_id)
    .eq("is_primary", true)
    .maybeSingle();
  return (data as DocBank | null) ?? null;
}
