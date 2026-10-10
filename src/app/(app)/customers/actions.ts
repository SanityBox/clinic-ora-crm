"use server";

import type { Enums } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff, requireWriter } from "@/lib/auth";
import { dbErrorMessage, optional, str, type ActionState } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { customerSearchFilter } from "@/lib/search";

const SOURCES = ["instagram", "facebook", "website", "referral", "whatsapp", "ai_agent", "other"];

export async function saveCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireWriter();
  const id = optional(formData, "id");
  const fullName = str(formData, "full_name");
  const phoneRaw = str(formData, "phone");
  const email = optional(formData, "email");
  const source = optional(formData, "source");

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.full_name = "שם מלא הוא שדה חובה";
  const phone = normalizePhone(phoneRaw);
  if (!phoneRaw) fieldErrors.phone = "טלפון הוא שדה חובה";
  else if (!phone) fieldErrors.phone = "מספר הטלפון לא תקין. דוגמה: 054-7821390";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "כתובת האימייל לא תקינה";
  if (source && !SOURCES.includes(source)) fieldErrors.source = "יש לבחור מקור מהרשימה";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();

  // BR-02: point to the existing card instead of failing on the unique constraint
  let dup = supabase.from("customers").select("id, full_name").eq("phone", phone!);
  if (id) dup = dup.neq("id", id);
  const { data: existing } = await dup.maybeSingle();
  if (existing) {
    return {
      fieldErrors: { phone: `הטלפון כבר שייך ל${existing.full_name}` },
      existingCustomer: { id: existing.id, name: existing.full_name },
    };
  }

  const row = {
    full_name: fullName,
    phone: phone!,
    email,
    source: source as Enums<"customer_source"> | null,
    marketing_consent: formData.get("marketing_consent") === "on",
    notes: optional(formData, "notes"),
  };

  let savedId = id;
  if (id) {
    const { error } = await supabase.from("customers").update(row).eq("id", id);
    if (error) return dbErrorMessage(error);
  } else {
    const staff = await requireStaff();
    const { data, error } = await supabase.from("customers").insert({ ...row, created_by: staff.id }).select("id").single();
    if (error) return dbErrorMessage(error);
    savedId = data.id;
  }

  revalidatePath("/", "layout");
  redirect(`/customers/${savedId}?toast=customer_saved`);
}

export async function deleteCustomer(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) redirect(`/customers/${id}?toast=no_permission`);
  revalidatePath("/", "layout");
  redirect("/customers?toast=customer_deleted");
}

export type CustomerOption = { id: string; full_name: string; phone: string };

const PICKER_LIMIT = 8;

export async function searchCustomers(q: string): Promise<{ customers: CustomerOption[]; more: boolean }> {
  await requireStaff();
  const filter = customerSearchFilter(q);
  if (!filter) return { customers: [], more: false };
  const supabase = await createClient();
  // one extra row tells the picker there are more matches than it shows
  const { data } = await supabase.from("customers").select("id, full_name, phone").or(filter).order("full_name").limit(PICKER_LIMIT + 1);
  return { customers: (data ?? []).slice(0, PICKER_LIMIT), more: (data?.length ?? 0) > PICKER_LIMIT };
}
