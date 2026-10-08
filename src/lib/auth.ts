import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "staff" | "viewer";

export type CurrentStaff = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  canWrite: boolean;
  isAdmin: boolean;
};

// One lookup per request: the session user plus their row in public.staff (role, active).
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, full_name, email, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!staff || !staff.is_active) return null;

  const role = staff.role as Role;
  return {
    id: staff.id,
    fullName: staff.full_name,
    email: staff.email,
    role,
    canWrite: role === "admin" || role === "staff",
    isAdmin: role === "admin",
  };
});

export async function requireStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login?inactive=1");
  return staff;
}

export async function requireWriter(): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (!staff.canWrite) redirect("/?toast=no_permission");
  return staff;
}

export async function requireAdmin(): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (!staff.isAdmin) redirect("/?toast=no_permission");
  return staff;
}
