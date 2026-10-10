"use server";

import type { Enums } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireWriter } from "@/lib/auth";
import { dbErrorMessage, optional, str, type ActionState, type Overlap } from "@/lib/errors";
import { formatTime, israelLocalToDate, israelLocalToTimestamptz } from "@/lib/format";

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

  // BR-08ג: a warning, not a block. Some overlaps are intentional (another client while numbing cream takes effect).
  if (row.status === "scheduled" && str(formData, "confirm_overlap") !== "1") {
    const start = israelLocalToDate(date, time).getTime();
    const end = start + duration * 60_000;
    const { data: nearby, error } = await supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, staff_id, customer_id, customers(full_name), treatments(name), staff:staff!appointments_staff_id_fkey(full_name)")
      .eq("status", "scheduled")
      .gte("starts_at", new Date(start - 480 * 60_000).toISOString())
      .lt("starts_at", new Date(end).toISOString());
    if (error) return dbErrorMessage(error);
    const overlaps: Overlap[] = [];
    for (const a of nearby) {
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = aStart + a.duration_minutes * 60_000;
      if (a.id === id || aEnd <= start) continue;
      const kind = row.staff_id && a.staff_id === row.staff_id ? "staff" : a.customer_id === customerId ? "customer" : null;
      if (!kind) continue;
      overlaps.push({
        id: a.id,
        kind,
        when: `${formatTime(a.starts_at)}–${formatTime(new Date(aEnd))}`,
        customer: a.customers?.full_name ?? "",
        treatment: a.treatments?.name ?? "",
        staff: a.staff?.full_name ?? "",
      });
    }
    if (overlaps.length) return { overlaps };
  }

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
  const { error } = await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
  if (error) redirect(`/appointments/${id}?toast=save_failed`);
  revalidatePath("/", "layout");
  redirect(`/appointments/${id}?toast=appointment_saved`);
}

export async function deleteAppointment(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const customerId = str(formData, "customer_id");
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) redirect(`/appointments/${id}?toast=save_failed`);
  revalidatePath("/", "layout");
  redirect(`/customers/${customerId}?toast=appointment_saved`);
}
