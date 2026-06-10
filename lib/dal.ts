import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  owner_id: string;
  bin: string;
  name: string;
  director: string | null;
  address: string | null;
  bank_account: string | null;
  bank_name: string | null;
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

/** The current user's company, or null if they haven't onboarded yet. */
export const getCompany = cache(async (): Promise<Company | null> => {
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

/** The company, or redirect to onboarding if the user hasn't set requisites. */
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
