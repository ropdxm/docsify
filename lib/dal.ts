import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Company = {
  id: string;
  owner_id: string;
  bin: string;
  name: string;
  director: string | null;
  address: string | null;
  bank_account: string | null;
  bank_name: string | null;
  is_profile_complete: boolean;
  created_at: string;
};

export type BankProfile = {
  id: string;
  company_id: string;
  label: string;
  iik: string;
  bank_name: string;
  bik: string;
  kbe: string;
  knp: string | null;
  is_primary: boolean;
  created_at: string;
};

/** The current user, or null. Memoized per request render. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user, or redirect to /login. */
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

/** Any company row owned by the user, including an internal billing-only row. */
export const getBillingCompany = cache(async (): Promise<Company | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  return data as Company | null;
});

/** The current user's completed company, or null until requisites are saved. */
export const getCompany = cache(async (): Promise<Company | null> => {
  const company = await getBillingCompany();
  // Treat pre-migration rows as complete so document access is not interrupted
  // if application and database deployments overlap briefly.
  return company && company.is_profile_complete !== false ? company : null;
});

/**
 * Return the user's company row, creating an internal billing-only row when
 * checkout happens before onboarding. It is completed in place later so paid
 * subscriptions and invoices keep the same company id.
 */
export async function ensureBillingCompany(): Promise<Company> {
  const user = await requireUser();
  const existing = await getBillingCompany();
  if (existing) return existing;

  const admin = createAdminClient();
  const draft = {
    owner_id: user.id,
    bin: `pending:${user.id}`,
    name: user.email?.split("@")[0] || "Docsify",
    is_profile_complete: false,
  };
  const { data, error } = await admin
    .from("companies")
    .upsert(draft, { onConflict: "owner_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Could not create billing profile: ${error.message}`);
  if (data) return data as Company;

  const { data: raced, error: readError } = await admin
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  if (readError) throw new Error(`Could not load billing profile: ${readError.message}`);
  return raced as Company;
}

/** The completed company, or redirect to onboarding if requisites are missing. */
export const requireCompany = cache(async (): Promise<Company> => {
  await requireUser();
  const company = await getCompany();
  if (!company) redirect("/onboarding");
  return company;
});

/** The company's bank requisite profiles, primary first. */
export const getBankProfiles = cache(
  async (companyId: string): Promise<BankProfile[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bank_profiles")
      .select("*")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    return (data ?? []) as BankProfile[];
  }
);
