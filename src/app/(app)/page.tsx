import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Headset, MessageCirclePlus, TriangleAlert, UserPlus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, ageLabel, formatTime, isoDateInIsrael, isOverdue, TZ } from "@/lib/format";
import { appointmentStatus, cancelReason, label, ticketStatus } from "@/lib/labels";
import { resolveIncident } from "./incident-actions";
import { Chip, EmptyState, Ltr, PageHeader, Section, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "מסך ראשי" };

type Stats = {
  new_count: number;
  in_progress_count: number;
  unassigned_count: number;
  overdue_count: number;
  today_appointments: number;
  no_show_count: number;
  attended_count: number;
  no_show_rate: number | null;
  by_assignee: { id: string | null; name: string; new_count: number; in_progress_count: number; overdue_count: number; total: number }[];
};

export default async function DashboardPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const today = isoDateInIsrael();

  const [{ data: stats, error }, { data: latest }, { data: todayAppts }, { count: mine }, { data: humanRequests }, { data: incidents, count: incidentCount }] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("tickets")
      .select("id, ticket_number, subject, status, priority, source, created_at, due_at, customers(full_name), assignee:staff!tickets_assignee_id_fkey(full_name)")
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("appointments")
      .select("id, starts_at, status, cancel_reason, customers(full_name), treatments(name), staff:staff!appointments_staff_id_fkey(full_name)")
      .gte("starts_at", `${today} 00:00:00 ${TZ}`)
      .lt("starts_at", `${addDays(today, 1)} 00:00:00 ${TZ}`)
      .order("starts_at"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).neq("status", "closed").eq("assignee_id", staff.id),
    // PRD 11.1: someone asked the agent for a person. Shown until a staff member starts handling it.
    supabase
      .from("tickets")
      .select("id, ticket_number, subject, created_at, customers(full_name)")
      .eq("source", "ai_agent")
      .eq("priority", "urgent")
      .eq("status", "new")
      .order("created_at"),
    // n8n reports integration failures here (error workflow, failed CloudChat handoff); shown until someone marks it handled
    supabase
      .from("integration_incidents")
      .select("id, source, node, message, created_at", { count: "exact" })
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (error) throw new Error(error.message);
  const s = stats as Stats;

  return (
    <>
      <PageHeader
        title={`שלום, ${staff.fullName.split(" ")[0]}`}
        subtitle="תמונת המצב של הקליניקה"
        actions={
          staff.canWrite && (
            <>
              <Link href="/tickets/new" className="btn btn-primary">
                <MessageCirclePlus size={18} aria-hidden /> קריאה חדשה
              </Link>
              <Link href="/appointments/new" className="btn btn-secondary">
                <CalendarPlus size={18} aria-hidden /> תור חדש
              </Link>
              <Link href="/customers/new" className="btn btn-secondary">
                <UserPlus size={18} aria-hidden /> לקוחה חדשה
              </Link>
            </>
          )
        }
      />

      {!!humanRequests?.length && (
        <section className="card mb-5 border-tone-red p-4" aria-labelledby="human-requests">
          <h2 id="human-requests" className="mb-2 flex items-center gap-2 font-semibold text-tone-red">
            <Headset size={20} aria-hidden /> ביקשו נציגה · {humanRequests.length}
          </h2>
          <ul className="flex flex-col">
            {humanRequests.map((t) => (
              <li key={t.id} className="border-b border-line last:border-0">
                <Link href={`/tickets/${t.id}`} className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 py-2 hover:text-brand">
                  <Ltr className="text-sm text-ink-soft">#{t.ticket_number}</Ltr>
                  <span className="font-medium">{t.customers?.full_name}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{t.subject}</span>
                  <span className="text-[13px] text-ink-soft">{ageLabel(t.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!incidents?.length && (
        <section className="card mb-5 border-tone-red p-4" aria-labelledby="incidents">
          <h2 id="incidents" className="mb-1 flex items-center gap-2 font-semibold text-tone-red">
            <TriangleAlert size={20} aria-hidden /> תקלה בחיבור לסוכן · {incidentCount ?? incidents.length}
            {(incidentCount ?? 0) > incidents.length && <span className="text-sm font-normal"> (מוצגות {incidents.length} האחרונות)</span>}
          </h2>
          <p className="mb-2 text-sm text-ink-soft">מוצגות עד שמסמנים &quot;טופל&quot;. פניות מהזמן הזה כדאי לבדוק גם ב-CloudChat.</p>
          <ul className="flex flex-col">
            {incidents.map((i) => (
              <li key={i.id} className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-2 last:border-0">
                <span className="text-[13px] text-ink-soft">{ageLabel(i.created_at)}</span>
                <span className="font-medium">{i.node ?? i.source}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                  {i.message.split(/(0\d{1,2}-?\d{3}-?\d{4})/).map((part, k) => (k % 2 ? <Ltr key={k}>{part}</Ltr> : part))}
                </span>
                {staff.canWrite && (
                  <form action={resolveIncident}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="btn btn-secondary min-h-11">טופל</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="קריאות חדשות" value={s.new_count} href="/tickets?status=new" />
        <Stat label="בטיפול" value={s.in_progress_count} href="/tickets?status=in_progress" />
        <Stat label="ממתינות לשיוך" value={s.unassigned_count} tone={s.unassigned_count ? "amber" : undefined} href="/tickets?assignee=none" />
        <Stat label="חורגות מעל 2 ימי עסקים" value={s.overdue_count} tone={s.overdue_count ? "red" : undefined} href="/tickets?overdue=1" />
        <Stat label="תורים היום" value={s.today_appointments} href="/appointments?range=today" />
        <Stat
          label="שיעור הברזות · 30 יום"
          value={s.no_show_rate === null ? "—" : <Ltr>{`${s.no_show_rate}%`}</Ltr>}
          tone={s.no_show_rate !== null && s.no_show_rate >= 20 ? "red" : undefined}
          hint={`${s.no_show_count} לא הגיעו מתוך ${s.no_show_count + s.attended_count}`}
        />
      </div>

      {staff.canWrite && (
        <Link href="/tickets?assignee=me" className="card mb-5 flex items-center justify-between p-4 hover:border-brand">
          <span className="font-medium">הקריאות הפתוחות שלי</span>
          <Chip tone={mine ? "brand" : "gray"}>{mine ?? 0}</Chip>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="קריאות פתוחות לפי אחראית">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="table-head">
                <th className="rounded-s-lg px-3 py-2 text-start font-medium">אחראית</th>
                <th className="px-2 py-2 text-center font-medium">חדשות</th>
                <th className="px-2 py-2 text-center font-medium">בטיפול</th>
                <th className="px-2 py-2 text-center font-medium">חורגות</th>
                <th className="rounded-e-lg px-2 py-2 text-center font-medium">סה&quot;כ</th>
              </tr>
            </thead>
            <tbody>
              {s.by_assignee.map((row) => (
                <tr key={row.id ?? "none"} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/tickets?assignee=${row.id ?? "none"}`} className="font-medium text-brand hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-2 text-center">{row.new_count}</td>
                  <td className="px-2 text-center">{row.in_progress_count}</td>
                  <td className={`px-2 text-center ${row.overdue_count ? "font-semibold text-tone-red" : ""}`}>{row.overdue_count}</td>
                  <td className="px-2 text-center font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="התורים של היום" actions={<Link href="/appointments?range=today" className="btn btn-ghost min-h-11 text-sm">לכל התורים</Link>}>
          {!todayAppts?.length ? (
            <EmptyState title="אין תורים היום" />
          ) : (
            <ul className="flex flex-col">
              {todayAppts.map((a) => {
                const st = appointmentStatus[a.status as keyof typeof appointmentStatus];
                return (
                  <li key={a.id} className="border-b border-line last:border-0">
                    <Link href={`/appointments/${a.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                      <Ltr className="w-12 font-semibold">{formatTime(a.starts_at)}</Ltr>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.customers?.full_name}</span>
                        <span className="block truncate text-[13px] text-ink-soft">
                          {a.treatments?.name}
                          {a.staff?.full_name && ` · ${a.staff.full_name}`}
                        </span>
                      </span>
                      <Chip tone={a.cancel_reason === "no_show" ? "red" : st.tone}>{a.cancel_reason ? label(cancelReason, a.cancel_reason) : st.label}</Chip>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="קריאות פתוחות אחרונות" className="mt-4" actions={<Link href="/tickets" className="btn btn-ghost min-h-11 text-sm">לכל הקריאות</Link>}>
        {!latest?.length ? (
          <EmptyState title="אין קריאות פתוחות" text="כל הפניות טופלו." />
        ) : (
          <ul className="flex flex-col">
            {latest.map((t) => {
              const st = ticketStatus[t.status as keyof typeof ticketStatus];
              const overdue = isOverdue(t.due_at, t.status);
              return (
                <li key={t.id} className="border-b border-line last:border-0">
                  <Link href={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 hover:text-brand">
                    <Ltr className="text-sm text-ink-soft">#{t.ticket_number}</Ltr>
                    <span className="font-medium">{t.customers?.full_name}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{t.subject}</span>
                    <Chip tone={st.tone}>{st.label}</Chip>
                    {t.priority === "urgent" && <Chip tone="red">דחופה</Chip>}
                    {t.source === "ai_agent" && <Chip tone="brand">סוכן AI</Chip>}
                    {overdue && <Chip tone="red">חורגת</Chip>}
                    <span className="w-full text-[13px] text-ink-soft sm:w-auto">
                      {t.assignee?.full_name ?? "לא שויכה"} · {ageLabel(t.created_at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
