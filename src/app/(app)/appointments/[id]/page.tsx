import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFormOptions } from "@/lib/options";
import { formatDateTime, isoDateInIsrael, timeInIsrael } from "@/lib/format";
import { appointmentStatus, cancelReason, label } from "@/lib/labels";
import { Chip, Ltr, PageHeader, Section } from "@/components/ui";
import { ActivityList, type ActivityRow } from "@/components/activity";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { AppointmentForm } from "../appointment-form";
import { deleteAppointment, markAppointmentCompleted } from "../actions";

export const metadata: Metadata = { title: "תור" };

export default async function AppointmentPage({ params }: PageProps<"/appointments/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: appt }, { data: activity }, options] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, customers(id, full_name, phone), treatments(name), creator:staff!appointments_created_by_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, entity_type, action, changes, actor_label, created_at")
      .eq("entity_type", "appointment")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    getFormOptions(),
  ]);
  if (!appt) notFound();

  const st = appointmentStatus[appt.status as keyof typeof appointmentStatus];
  const isPast = new Date(appt.starts_at).getTime() < Date.now();

  return (
    <>
      <PageHeader
        back={{ href: `/customers/${appt.customer_id}`, label: appt.customers?.full_name ?? "כרטיס לקוחה" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {appt.treatments?.name}
            <Chip tone={appt.cancel_reason === "no_show" ? "red" : st.tone}>{appt.cancel_reason ? label(cancelReason, appt.cancel_reason) : st.label}</Chip>
            {appt.status === "scheduled" && isPast && <Chip tone="amber">לעדכן סטטוס</Chip>}
          </span>
        }
        subtitle={
          <>
            <Link href={`/customers/${appt.customer_id}`} className="text-brand hover:underline">
              {appt.customers?.full_name}
            </Link>
            {" · "}
            <Ltr>{formatDateTime(appt.starts_at)}</Ltr>
            {appt.creator?.full_name && ` · נוצר על ידי ${appt.creator.full_name}`}
          </>
        }
        actions={
          staff.canWrite &&
          appt.status === "scheduled" && (
            <form action={markAppointmentCompleted}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton className="btn btn-secondary">
                <CheckCircle2 size={17} aria-hidden /> סימון כבוצע
              </SubmitButton>
            </form>
          )
        }
      />

      <AppointmentForm
        readOnly={!staff.canWrite}
        initial={{
          id,
          customer: appt.customers,
          treatment_id: appt.treatment_id,
          staff_id: appt.staff_id,
          date: isoDateInIsrael(appt.starts_at),
          time: timeInIsrael(appt.starts_at),
          duration_minutes: appt.duration_minutes,
          status: appt.status,
          cancel_reason: appt.cancel_reason,
          notes: appt.notes,
        }}
        treatments={options.treatments.filter((t) => t.is_active || t.id === appt.treatment_id)}
        staff={options.staff}
        cancelHref={`/customers/${appt.customer_id}`}
      />

      <Section title="יומן פעילות" className="mt-4">
        <ActivityList rows={(activity ?? []) as ActivityRow[]} />
      </Section>

      {staff.isAdmin && (
        <form action={deleteAppointment} className="mt-6 flex justify-end">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="customer_id" value={appt.customer_id} />
          <ConfirmSubmit message={`למחוק את התור של ${appt.customers?.full_name}? אי אפשר לבטל.`}>מחיקת התור</ConfirmSubmit>
        </form>
      )}
    </>
  );
}
