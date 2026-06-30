import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company } from "@/lib/dal";

// A document another business has sent to us, matched by the recipient's
// БИН/ИИН. Drafts are private to their owner and never belong in Incoming.
export type IncomingDocument = {
  id: string;
  type: string;
  number: string;
  title: string | null;
  date: string;
  status: string;
  share_token: string;
  total_amount: number;
  from_name: string;
  from_bin: string;
};

type Row = {
  id: string;
  type: string;
  number: string;
  title: string | null;
  date: string;
  status: string;
  share_token: string;
  total_amount: number;
  company:
    | { name: string; bin: string }
    | { name: string; bin: string }[]
    | null;
};

/**
 * Documents sent TO this company. RLS scopes the `documents` table to the
 * owner's company, but an incoming document is owned by a *different* business,
 * so we read with the service-role client - strictly filtered to documents
 * whose counterparty БИН equals the authenticated company's БИН.
 */
export const getIncomingDocuments = cache(
  async (company: Company): Promise<IncomingDocument[]> => {
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
        "id, type, number, title, date, status, share_token, total_amount, company:companies(name, bin)"
      )
      .in("counterparty_id", cpIds)
      .in("status", ["sent", "signed", "paid"])
      .order("updated_at", { ascending: false });

    return ((data ?? []) as Row[]).map((d) => {
      const c = Array.isArray(d.company) ? d.company[0] : d.company;
      return {
        id: d.id,
        type: d.type,
        number: d.number,
        title: d.title,
        date: d.date,
        status: d.status,
        share_token: d.share_token,
        total_amount: d.total_amount,
        from_name: c?.name ?? "-",
        from_bin: c?.bin ?? "",
      };
    });
  }
);
