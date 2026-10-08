import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFormOptions } from "@/lib/options";
import { ageLabel, formatDateTime, formatPhone, isOverdue } from "@/lib/format";
import { label, ticketPriority, ticketSource, ticketStatus } from "@/lib/labels";
import { Chip, Ltr, PageHeader, Section } from "@/components/ui";
import { ActivityList, type ActivityRow } from "@/components/activity";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { TicketForm } from "../ticket-form";
import { closeTicket, deleteTicket, startTicket } from "../actions";

export const metadata: Metadata = { title: "קריאת שירות" };

export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ticket }, { data: activity }, { staff: team }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*, customers(id, full_name, phone), creator:staff!tickets_created_by_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, entity_type, action, changes, actor_label, created_at")
      .eq("entity_type", "ticket")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    getFormOptions(),
  ]);
  if (!ticket) notFound();

  const st = ticketStatus[ticket.status as keyof typeof ticketStatus];
  const overdue = isOverdue(ticket.created_at, ticket.status);
  const openedBy = ticket.source === "ai_agent" && !ticket.created_by ? "סוכן AI" : ticket.creator?.full_name ?? "—";

  return (
    <>
      <PageHeader
        back={{ href: "/tickets", label: "קריאות שירות" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Ltr className="text-ink-soft">#{ticket.ticket_number}</Ltr>
            {ticket.subject}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Chip tone={st.tone}>{st.label}</Chip>
            {overdue && <Chip tone="red">חורגת · {ageLabel(ticket.created_at)}</Chip>}
            {ticket.priority === "urgent" && <Chip tone="red">{ticketPriority.urgent}</Chip>}
            <span>
              <Link href={`/customers/${ticket.customer_id}`} className="text-brand hover:underline">
                {ticket.customers?.full_name}
              </Link>{" "}
              <Ltr>{formatPhone(ticket.customers?.phone)}</Ltr>
            </span>
          </span>
        }
        actions={
          staff.canWrite && (
            <>
              {ticket.status === "new" && (
                <form action={startTicket}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton className="btn btn-primary">
                    <PlayCircle size={17} aria-hidden /> התחלת טיפול
                  </SubmitButton>
                </form>
              )}
              {ticket.status !== "closed" && (
                <form action={closeTicket}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton className="btn btn-secondary">
                    <CheckCircle2 size={17} aria-hidden /> סגירה
                  </SubmitButton>
                </form>
              )}
            </>
          )
        }
      />

      <dl className="card mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-soft">נפתחה</dt>
          <dd><Ltr>{formatDateTime(ticket.created_at)}</Ltr></dd>
        </div>
        <div>
          <dt className="text-ink-soft">נפתחה על ידי</dt>
          <dd>{openedBy}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">מקור</dt>
          <dd>{label(ticketSource, ticket.source)}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">נסגרה</dt>
          <dd>{ticket.closed_at ? <Ltr>{formatDateTime(ticket.closed_at)}</Ltr> : "—"}</dd>
        </div>
        {ticket.reported_name && ticket.reported_name !== ticket.customers?.full_name && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-ink-soft">השם שנמסר בשיחה</dt>
            <dd>{ticket.reported_name}</dd>
          </div>
        )}
      </dl>

      <TicketForm
        readOnly={!staff.canWrite}
        initial={{
          id,
          customer: ticket.customers,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          assignee_id: ticket.assignee_id,
          priority: ticket.priority,
          source: ticket.source,
        }}
        staff={team}
        cancelHref="/tickets"
      />

      <Section title="יומן פעילות" className="mt-4">
        <ActivityList rows={(activity ?? []) as ActivityRow[]} />
      </Section>

      {staff.isAdmin && (
        <form action={deleteTicket} className="mt-6 flex justify-end">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit message={`למחוק את קריאה #${ticket.ticket_number}? אי אפשר לבטל.`}>מחיקת הקריאה</ConfirmSubmit>
        </form>
      )}
    </>
  );
}
