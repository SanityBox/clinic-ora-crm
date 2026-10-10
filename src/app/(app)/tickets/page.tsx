import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFormOptions } from "@/lib/options";
import { ageLabel, isOverdue, OVERDUE_BUSINESS_DAYS, requestTime } from "@/lib/format";
import { label, ticketSource, ticketStatus } from "@/lib/labels";
import { Chip, countLabel, EmptyState, Ltr, PageHeader, Pager } from "@/components/ui";

export const metadata: Metadata = { title: "קריאות שירות" };

const statusFilters = { open: "פתוחות", new: "חדשה", in_progress: "בטיפול", closed: "נסגרה", all: "הכל" } as const;
type StatusFilter = keyof typeof statusFilters;
const PAGE_SIZE = 50;

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status: StatusFilter = typeof sp.status === "string" && sp.status in statusFilters ? (sp.status as StatusFilter) : "open";
  const assignee = typeof sp.assignee === "string" ? sp.assignee : "";
  const overdueOnly = sp.overdue === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select("id, ticket_number, subject, status, priority, source, created_at, due_at, customer_id, customers(full_name), assignee:staff!tickets_assignee_id_fkey(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === "open") query = query.neq("status", "closed");
  else if (status !== "all") query = query.eq("status", status);
  if (assignee === "me") query = query.eq("assignee_id", staff.id);
  else if (assignee === "none") query = query.is("assignee_id", null);
  else if (assignee) query = query.eq("assignee_id", assignee);
  if (overdueOnly) {
    query = query.neq("status", "closed").lt("due_at", new Date(requestTime()).toISOString());
  }

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ status, assignee, overdue: overdueOnly ? "1" : "", ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/tickets?${p}`;
  };

  const [{ data: tickets, count, error }, { staff: team }] = await Promise.all([query, getFormOptions()]);
  if (error?.code === "PGRST103") redirect(qs({ page: "" }));
  if (error) throw new Error(error.message);
  const total = count ?? 0;


  return (
    <>
      <PageHeader
        title="קריאות שירות"
        subtitle={`${statusFilters[status]}${overdueOnly ? " · חורגות בלבד" : ""} · ${countLabel(total, "קריאות", page, PAGE_SIZE)}`}
        actions={
          staff.canWrite && (
            <Link href="/tickets/new" className="btn btn-primary">
              <Plus size={18} aria-hidden /> קריאה חדשה
            </Link>
          )
        }
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="סטטוס">
        {(Object.keys(statusFilters) as StatusFilter[]).map((s) => (
          <Link key={s} href={qs({ status: s })} role="tab" aria-selected={s === status} className={`btn min-h-10 shrink-0 text-sm ${s === status ? "btn-primary" : "btn-secondary"}`}>
            {statusFilters[s]}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={qs({ assignee: assignee === "me" ? "" : "me" })} className={`btn min-h-10 text-sm ${assignee === "me" ? "btn-primary" : "btn-secondary"}`}>
          הקריאות שלי
        </Link>
        <Link href={qs({ assignee: assignee === "none" ? "" : "none" })} className={`btn min-h-10 text-sm ${assignee === "none" ? "btn-primary" : "btn-secondary"}`}>
          ממתינות לשיוך
        </Link>
        <Link href={qs({ overdue: overdueOnly ? "" : "1" })} className={`btn min-h-10 text-sm ${overdueOnly ? "btn-primary" : "btn-secondary"}`}>
          חורגות (מעל {OVERDUE_BUSINESS_DAYS} ימי עסקים)
        </Link>
        <form action="/tickets" className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          {overdueOnly && <input type="hidden" name="overdue" value="1" />}
          <label className="sr-only" htmlFor="f-assignee">אחראית</label>
          <select id="f-assignee" name="assignee" defaultValue={["me", "none"].includes(assignee) ? "" : assignee} className="input min-h-10 w-40">
            <option value="">כל האחראיות</option>
            {team.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          <button className="btn btn-secondary min-h-10 text-sm" type="submit">סינון</button>
        </form>
      </div>

      {!tickets?.length ? (
        <div className="card">
          <EmptyState icon={<MessageSquareText size={32} />} title="אין קריאות שמתאימות לסינון" text="כל פנייה של לקוחה נרשמת כאן, עם סטטוס ואחראית." action={staff.canWrite && <Link href="/tickets/new" className="btn btn-primary">פתיחת קריאה</Link>} />
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {tickets.map((t) => {
            const st = ticketStatus[t.status as keyof typeof ticketStatus];
            const overdue = isOverdue(t.due_at, t.status);
            return (
              <li key={t.id} className={overdue ? "border-s-4 border-s-tone-red" : ""}>
                <Link href={`/tickets/${t.id}`} className="flex flex-col gap-1 p-3 hover:bg-canvas sm:px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Ltr className="text-sm text-ink-soft">#{t.ticket_number}</Ltr>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.subject}</span>
                    <Chip tone={st.tone}>{st.label}</Chip>
                    {overdue && <Chip tone="red">חורגת</Chip>}
                    {t.priority === "urgent" && <Chip tone="red">דחופה</Chip>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-[13px] text-ink-soft">
                    <span>{t.customers?.full_name}</span>
                    <span>אחראית: {t.assignee?.full_name ?? "לא שויכה"}</span>
                    {t.source && <span>{label(ticketSource, t.source)}</span>}
                    <span>{ageLabel(t.created_at)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(p) => qs({ page: String(p) })} />
    </>
  );
}
