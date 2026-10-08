import { createClient } from "@/lib/supabase/server";
import type { CustomerOption } from "@/app/(app)/customers/actions";

export async function getFormOptions() {
  const supabase = await createClient();
  const [{ data: treatments }, { data: staff }] = await Promise.all([
    supabase.from("treatments").select("id, name, price, duration_minutes, is_active").order("sort_order"),
    supabase.from("staff").select("id, full_name, role").eq("is_active", true).neq("role", "viewer").order("full_name"),
  ]);
  return { treatments: treatments ?? [], staff: staff ?? [] };
}

export async function getCustomerOption(id: string | undefined | null): Promise<CustomerOption | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("id, full_name, phone").eq("id", id).maybeSingle();
  return data;
}
