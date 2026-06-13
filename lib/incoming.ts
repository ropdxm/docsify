import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company } from "@/lib/dal";

// A договор that another business has sent to us — i.e. one where WE are the
// counterparty (matched by БИН). The owner already signed (status 'sent') or
// both parties signed (status 'signed').
export type IncomingDogovor = {
  id: string;
  number: string;
  title: string | null;
  date: string;
  status: string;
  share_token: string;
  from_name: string;
  from_bin: string;
};

type Row = {
  id: string;
  number: string;
  title: string | null;
  date: string;
  status: string;
  share_token: string;
  company:
    | { name: string; bin: string }
    | { name: string; bin: string }[]
    | null;
};

/**
 * Договоры sent TO this company. RLS scopes the `documents` table to the
 * owner's company, but an incoming договор is owned by a *different* business,
 * so we read with the service-role client — strictly filtered to documents
 * whose counterparty БИН equals the authenticated company's БИН.
 */
export const getIncomingDogovors = cache(
  async (company: Company): Promise<IncomingDogovor[]> => {
    const admin = createAdminClient();

    // Counterparty rows that represent us (by БИН) in other businesses' lists.
    const { data: cps } = await admin
      .from("counterparties")
      .select("id")
      .eq("bin", company.bin);
    const cpIds = (cps ?? []).map((c) => c.id as string);
    if (cpIds.length === 0) return [];

    const { data } = await admin
      .from("documents")
      .select(
        "id, number, title, date, status, share_token, company:companies(name, bin)"
      )
      .eq("type", "dogovor")
      .in("counterparty_id", cpIds)
      .neq("company_id", company.id) // never our own documents
      .in("status", ["sent", "signed"])
      .order("updated_at", { ascending: false });

    return ((data ?? []) as Row[]).map((d) => {
      const c = Array.isArray(d.company) ? d.company[0] : d.company;
      return {
        id: d.id,
        number: d.number,
        title: d.title,
        date: d.date,
        status: d.status,
        share_token: d.share_token,
        from_name: c?.name ?? "—",
        from_bin: c?.bin ?? "",
      };
    });
  }
);
