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

type StaffRef = { id: string; full_name: string; is_active: boolean; role: string };

/** Keeps the current therapist/assignee in the edit list even when she is inactive or view-only, so saving does not unassign her (PRD 8.5). */
export function withCurrentStaff<T extends { id: string; full_name: string }>(staff: T[], current: StaffRef | null): { id: string; full_name: string }[] {
  if (!current || staff.some((s) => s.id === current.id)) return staff;
  return [...staff, { id: current.id, full_name: `${current.full_name} (${current.is_active ? "צפייה בלבד" : "לא פעילה"})` }];
}
