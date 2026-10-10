"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { str } from "@/lib/errors";

/** "טופל" on the dashboard incident banner (PRD 11.1): the incident stays until someone handles it. */
export async function resolveIncident(formData: FormData) {
  await requireWriter();
  const id = Number(str(formData, "id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_incident", { p_id: id });
  if (error) redirect("/?toast=save_failed");
  revalidatePath("/", "layout");
  redirect("/?toast=incident_resolved");
}
