"use server";

import type { Enums } from "@/lib/database.types";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { dbErrorMessage, str, type ActionState } from "@/lib/errors";

const ROLES = ["admin", "staff", "viewer"];

export async function updateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = str(formData, "id");
  const role = str(formData, "role");
  const isActive = formData.get("is_active") === "on";
  if (!ROLES.includes(role)) return { error: "תפקיד לא תקין" };
  if (id === me.id && (role !== "admin" || !isActive)) {
    return { error: "אי אפשר להוריד את עצמך מתפקיד מנהלת או להשבית את עצמך" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ role: role as Enums<"staff_role">, is_active: isActive, specialty: str(formData, "specialty") || null })
    .eq("id", id);
  if (error) return dbErrorMessage(error);
  revalidatePath("/", "layout");
  return { error: undefined };
}

export async function saveTreatment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const price = Number(str(formData, "price"));
  const duration = Number(str(formData, "duration_minutes"));
  if (name.length < 2) return { error: "יש למלא שם טיפול" };
  if (!Number.isInteger(price) || price < 0) return { error: "מחיר לא תקין" };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) return { error: "משך בין 5 ל-480 דקות" };

  const supabase = await createClient();
  const row = { name, price, duration_minutes: duration, is_active: formData.get("is_active") === "on" };
  const { error } = id
    ? await supabase.from("treatments").update(row).eq("id", Number(id))
    : await supabase.from("treatments").insert({ ...row, sort_order: 100 });
  if (error) return error.code === "23505" ? { error: "כבר קיים טיפול בשם הזה" } : dbErrorMessage(error);
  revalidatePath("/", "layout");
  return { error: undefined };
}
