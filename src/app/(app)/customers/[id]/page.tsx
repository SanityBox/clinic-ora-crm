import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, MessageCirclePlus, MessageCircle, Pencil, Phone, CalendarClock } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPhone, formatTime, formatWeekday, whatsappLink, ageLabel, isOverdue, requestTime } from "@/lib/format";
import { appointmentStatus, cancelReason, customerSource, label, ticketStatus } from "@/lib/labels";
import { Chip, EmptyState, Ltr, PageHeader, Section } from "@/components/ui";
import { ActivityList, type ActivityRow } from "@/components/activity";
import { ConfirmSubmit } from "@/components/client";
import { deleteCustomer } from "../actions";

export const metadata: Metadata = { title: "כרטיס לקוחה" };

export default async function CustomerCardPage({ params }: PageProps<"/customers/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: appointments }, { data: tickets }, { data: activity }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, status, cancel_reason, notes, treatments(name), staff:staff!appointments_staff_id_fkey(full_name)")
      .eq("customer_id", id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("tickets")
      .select("id, ticket_number, subject, status, priority, created_at, assignee:staff!tickets_assignee_id_fkey(full_name)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id, entity_type, action, changes, actor_label, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!customer) notFound();

  const now = requestTime();
  const appts = appointments ?? [];
  const upcoming = appts
    .filter((a) => a.status === "scheduled" && new Date(a.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = appts.filter((a) => !upcoming.includes(a));
  const next = upcoming[0];
  const allTickets = tickets ?? [];
  const openTickets = allTickets.filter((t) => t.status !== "closed");
  const orderedTickets = [...openTickets, ...allTickets.filter((t) => t.status === "closed")];

  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "לקוחות" }}
        title={customer.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Ltr>{formatPhone(customer.phone)}</Ltr>
            {customer.email && <Ltr>{customer.email}</Ltr>}
            <span>מקור: {label(customerSource, customer.source)}</span>
            <span>
              הצטרפה <Ltr>{formatDate(customer.created_at)}</Ltr>
            </span>
          </span>
        }
        actions={
          <>
            <a href={`tel:${customer.phone}`} className="btn btn-secondary" aria-label="חיוג">
              <Phone size={17} aria-hidden /> חיוג
            </a>
            <a href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <MessageCircle size={17} aria-hidden /> וואטסאפ
            </a>
            {staff.canWrite && (
              <Link href={`/customers/${id}/edit`} className="btn btn-secondary">
                <Pencil size={17} aria-hidden /> עריכה
              </Link>
            )}
          </>
        }
      />

      {/* Next appointment + primary actions stay on top on mobile */}
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="card flex items-center gap-3 border-brand/30 bg-brand-soft/60 p-4">
          <CalendarClock size={26} className="shrink-0 text-brand" aria-hidden />
          {next ? (
            <div>
              <div className="text-[13px] text-ink-soft">התור הבא</div>
              <div className="font-semibold">
                יום {formatWeekday(next.starts_at).replace("יום ", "")}, <Ltr>{formatDate(next.starts_at)}</Ltr> בשעה <Ltr>{formatTime(next.starts_at)}</Ltr>
              </div>
              <div className="text-sm">
                {next.treatments?.name}
                {next.staff?.full_name && ` · ${next.staff.full_name}`}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[13px] text-ink-soft">התור הבא</div>
              <div className="font-semibold">אין תור עתידי</div>
            </div>
          )}
        </div>
        {staff.canWrite && (
          <div className="flex gap-2 md:flex-col">
            <Link href={`/appointments/new?customer=${id}`} className="btn btn-primary flex-1">
              <CalendarPlus size={18} aria-hidden /> תור חדש
            </Link>
            <Link href={`/tickets/new?customer=${id}`} className="btn btn-secondary flex-1">
              <MessageCirclePlus size={18} aria-hidden /> קריאה חדשה
            </Link>
          </div>
        )}
      </div>

      {customer.notes && (
        <div className="card mb-4 p-4 text-sm">
          <span className="font-medium">הערות: </span>
          <span className="whitespace-pre-line">{customer.notes}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`תורים (${appts.length})`}>
          {!appts.length ? (
            <EmptyState title="עוד אין תורים ללקוחה" action={staff.canWrite && <Link href={`/appointments/new?customer=${id}`} className="btn btn-secondary">קביעת תור</Link>} />
          ) : (
            <div className="flex flex-col gap-4">
              {upcoming.length > 0 && (
                <div>
                  <h3 className="mb-1 text-[13px] font-medium text-ink-soft">עתידיים</h3>
                  <AppointmentList items={upcoming} />
                </div>
              )}
              {history.length > 0 && (
                <div>
                  <h3 className="mb-1 text-[13px] font-medium text-ink-soft">היסטוריה</h3>
                  <AppointmentList items={history} />
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title={`קריאות שירות (${openTickets.length} פתוחות)`}>
          {!orderedTickets.length ? (
            <EmptyState title="אין קריאות שירות" action={staff.canWrite && <Link href={`/tickets/new?customer=${id}`} className="btn btn-secondary">פתיחת קריאה</Link>} />
          ) : (
            <ul className="flex flex-col">
              {orderedTickets.map((t) => {
                const st = ticketStatus[t.status as keyof typeof ticketStatus];
                const overdue = isOverdue(t.created_at, t.status);
                return (
                  <li key={t.id} className="border-b border-line last:border-0">
                    <Link href={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 hover:text-brand">
                      <Ltr className="text-sm text-ink-soft">#{t.ticket_number}</Ltr>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.subject}</span>
                      <Chip tone={st.tone}>{st.label}</Chip>
                      {overdue && <Chip tone="red">חורגת</Chip>}
                      <span className="w-full text-[13px] text-ink-soft">
                        {t.assignee?.full_name ?? "לא שויכה"} · {ageLabel(t.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="יומן פעילות" className="mt-4">
        <ActivityList rows={(activity ?? []) as ActivityRow[]} />
      </Section>

      {staff.isAdmin && (
        <form action={deleteCustomer} className="mt-6 flex justify-end">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit message={`למחוק את ${customer.full_name}? יימחקו גם ${appts.length} תורים ו-${allTickets.length} קריאות. אי אפשר לבטל.`}>
            מחיקת הלקוחה
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

type ApptItem = {
  id: string;
  starts_at: string;
  status: string;
  cancel_reason: string | null;
  treatments: { name: string } | null;
  staff: { full_name: string } | null;
};

function AppointmentList({ items }: { items: ApptItem[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((a) => {
        const st = appointmentStatus[a.status as keyof typeof appointmentStatus];
        const needsUpdate = a.status === "scheduled" && new Date(a.starts_at).getTime() < requestTime();
        return (
          <li key={a.id} className="border-b border-line last:border-0">
            <Link href={`/appointments/${a.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 hover:text-brand">
              <span className="text-sm">
                <Ltr>{formatDate(a.starts_at)}</Ltr> <Ltr className="text-ink-soft">{formatTime(a.starts_at)}</Ltr>
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{a.treatments?.name}</span>
              <Chip tone={a.cancel_reason === "no_show" ? "red" : st.tone}>{a.cancel_reason ? label(cancelReason, a.cancel_reason) : st.label}</Chip>
              {needsUpdate && <Chip tone="amber">לעדכן סטטוס</Chip>}
              {a.staff?.full_name && <span className="w-full text-[13px] text-ink-soft">{a.staff.full_name}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
