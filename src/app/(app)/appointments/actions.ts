"use server";

import type { Enums } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireWriter } from "@/lib/auth";
import { dbErrorMessage, optional, str, type ActionState } from "@/lib/errors";
import { israelLocalToTimestamptz } from "@/lib/format";

const STATUSES = ["scheduled", "completed", "cancelled"];
const REASONS = ["customer", "clinic", "no_show"];

export async function saveAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireWriter();
  const id = optional(formData, "id");
  const customerId = str(formData, "customer_id");
  const treatmentId = Number(str(formData, "treatment_id"));
  const date = str(formData, "date");
  const time = str(formData, "time");
  const duration = Number(str(formData, "duration_minutes"));
  const status = str(formData, "status") || "scheduled";
  const cancelReason = optional(formData, "cancel_reason");

  const fieldErrors: Record<string, string> = {};
  if (!customerId) fieldErrors.customer_id = "יש לבחור לקוחה";
  if (!treatmentId) fieldErrors.treatment_id = "יש לבחור סוג טיפול";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fieldErrors.date = "יש לבחור תאריך";
  if (!/^\d{2}:\d{2}$/.test(time)) fieldErrors.time = "יש לבחור שעה";
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) fieldErrors.duration_minutes = "משך בין 5 ל-480 דקות";
  if (!STATUSES.includes(status)) fieldErrors.status = "סטטוס לא תקין";
  if (status === "cancelled" && (!cancelReason || !REASONS.includes(cancelReason))) fieldErrors.cancel_reason = "יש לבחור סיבת ביטול";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const row = {
    customer_id: customerId,
    treatment_id: treatmentId,
    staff_id: optional(formData, "staff_id"),
    starts_at: israelLocalToTimestamptz(date, time),
    duration_minutes: duration,
    status: status as Enums<"appointment_status">,
    cancel_reason: status === "cancelled" ? (cancelReason as Enums<"cancel_reason">) : null,
    notes: optional(formData, "notes"),
  };

  const supabase = await createClient();
  let savedId = id;
  if (id) {
    const { error } = await supabase.from("appointments").update(row).eq("id", id);
    if (error) return dbErrorMessage(error);
  } else {
    const { data, error } = await supabase.from("appointments").insert({ ...row, created_by: staff.id }).select("id").single();
    if (error) return dbErrorMessage(error);
    savedId = data.id;
  }

  revalidatePath("/", "layout");
  const back = str(formData, "return_to");
  redirect(`${back.startsWith("/customers/") ? back : `/appointments/${savedId}`}?toast=appointment_saved`);
}

export async function markAppointmentCompleted(formData: FormData) {
  await requireWriter();
  const id = str(formData, "id");
  const supabase = await createClient();
  await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/appointments/${id}?toast=appointment_saved`);
}

export async function deleteAppointment(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const customerId = str(formData, "customer_id");
  const supabase = await createClient();
  await supabase.from("appointments").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/customers/${customerId}?toast=appointment_saved`);
}
