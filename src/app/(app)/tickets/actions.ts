"use server";

import type { Enums } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireWriter } from "@/lib/auth";
import { dbErrorMessage, optional, str, type ActionState } from "@/lib/errors";

const STATUSES = ["new", "in_progress", "closed"];
const PRIORITIES = ["normal", "urgent"];
const SOURCES = ["phone", "whatsapp", "instagram", "facebook", "website", "walk_in", "ai_agent"];

export async function saveTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireWriter();
  const id = optional(formData, "id");
  const customerId = str(formData, "customer_id");
  const description = str(formData, "description");
  const status = str(formData, "status") || "new";
  const assigneeId = optional(formData, "assignee_id");
  const priority = str(formData, "priority") || "normal";
  const source = optional(formData, "source");

  const fieldErrors: Record<string, string> = {};
  if (!customerId) fieldErrors.customer_id = "יש לבחור לקוחה";
  if (!description) fieldErrors.description = "תיאור הפנייה הוא שדה חובה";
  if (!STATUSES.includes(status)) fieldErrors.status = "סטטוס לא תקין";
  if (status === "in_progress" && !assigneeId) fieldErrors.assignee_id = "קריאה בטיפול חייבת אחראית";
  if (!PRIORITIES.includes(priority)) fieldErrors.priority = "עדיפות לא תקינה";
  if (source && !SOURCES.includes(source)) fieldErrors.source = "מקור לא תקין";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const row = {
    customer_id: customerId,
    subject: optional(formData, "subject"),
    description,
    status: status as Enums<"ticket_status">,
    assignee_id: assigneeId,
    priority: priority as Enums<"ticket_priority">,
    source: source as Enums<"ticket_source"> | null,
  };

  const supabase = await createClient();
  let savedId = id;
  if (id) {
    const { error } = await supabase.from("tickets").update(row).eq("id", id);
    if (error) return dbErrorMessage(error);
  } else {
    const { data, error } = await supabase.from("tickets").insert({ ...row, created_by: staff.id }).select("id").single();
    if (error) return dbErrorMessage(error);
    savedId = data.id;
  }

  revalidatePath("/", "layout");
  redirect(`/tickets/${savedId}?toast=ticket_saved`);
}

/** "התחלת טיפול": assigns the ticket to the current user and moves it to in progress. */
export async function startTicket(formData: FormData) {
  const staff = await requireWriter();
  const id = str(formData, "id");
  const supabase = await createClient();
  await supabase.from("tickets").update({ status: "in_progress", assignee_id: staff.id }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/tickets/${id}?toast=ticket_saved`);
}

export async function closeTicket(formData: FormData) {
  await requireWriter();
  const id = str(formData, "id");
  const supabase = await createClient();
  await supabase.from("tickets").update({ status: "closed" }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/tickets/${id}?toast=ticket_saved`);
}

export async function deleteTicket(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const supabase = await createClient();
  await supabase.from("tickets").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/tickets?toast=ticket_saved");
}
