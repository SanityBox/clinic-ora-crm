import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFormOptions } from "@/lib/options";
import { addDays, formatDate, formatPhone, formatTime, formatWeekday, isoDateInIsrael, TZ } from "@/lib/format";
import { appointmentStatus, cancelReason, label } from "@/lib/labels";
import { Chip, EmptyState, Ltr, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "תורים" };

const ranges = {
  today: "היום",
  week: "7 הימים הקרובים",
  upcoming: "עתידיים",
  past: "עבר",
  all: "הכל",
} as const;
type Range = keyof typeof ranges;

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const range: Range = typeof sp.range === "string" && sp.range in ranges ? (sp.range as Range) : "today";
  const status = typeof sp.status === "string" && sp.status in appointmentStatus ? sp.status : "";
  const therapist = typeof sp.staff === "string" ? sp.staff : "";

  const today = isoDateInIsrael();
  const dayStart = (d: string) => `${d} 00:00:00 ${TZ}`;
  const nowIso = new Date().toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, starts_at, status, cancel_reason, customer_id, customers(full_name, phone), treatments(name), staff:staff!appointments_staff_id_fkey(full_name)")
    .limit(200);

  if (range === "today") query = query.gte("starts_at", dayStart(today)).lt("starts_at", dayStart(addDays(today, 1)));
  if (range === "week") query = query.gte("starts_at", dayStart(today)).lt("starts_at", dayStart(addDays(today, 7)));
  if (range === "upcoming") query = query.gte("starts_at", nowIso);
  if (range === "past") query = query.lt("starts_at", nowIso);
  if (status) query = query.eq("status", status);
  if (therapist) query = query.eq("staff_id", therapist);
  query = query.order("starts_at", { ascending: range !== "past" && range !== "all" });

  const [{ data: appts, error }, { staff: team }] = await Promise.all([query, getFormOptions()]);
  if (error) throw new Error(error.message);

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ range, status, staff: therapist, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/appointments?${p}`;
  };

  return (
    <>
      <PageHeader
        title="תורים"
        subtitle={`${ranges[range]} · ${appts?.length ?? 0} תורים`}
        actions={
          staff.canWrite && (
            <Link href="/appointments/new" className="btn btn-primary">
              <Plus size={18} aria-hidden /> תור חדש
            </Link>
          )
        }
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="טווח זמן">
        {(Object.keys(ranges) as Range[]).map((r) => (
          <Link key={r} href={qs({ range: r })} role="tab" aria-selected={r === range} className={`btn min-h-10 shrink-0 text-sm ${r === range ? "btn-primary" : "btn-secondary"}`}>
            {ranges[r]}
          </Link>
        ))}
      </div>

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex" action="/appointments">
        <input type="hidden" name="range" value={range} />
        <label className="sr-only" htmlFor="f-status">סטטוס</label>
        <select id="f-status" name="status" defaultValue={status} className="input sm:w-40">
          <option value="">כל הסטטוסים</option>
          {Object.entries(appointmentStatus).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-staff">מטפלת</label>
        <select id="f-staff" name="staff" defaultValue={therapist} className="input sm:w-44">
          <option value="">כל המטפלות</option>
          {team.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        <button className="btn btn-secondary col-span-2" type="submit">סינון</button>
      </form>

      {!appts?.length ? (
        <div className="card">
          <EmptyState
            icon={<CalendarDays size={32} />}
            title={range === "today" ? "אין תורים היום" : "אין תורים בטווח הזה"}
            action={staff.canWrite && <Link href="/appointments/new" className="btn btn-primary">קביעת תור</Link>}
          />
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {appts.map((a) => {
            const st = appointmentStatus[a.status as keyof typeof appointmentStatus];
            const needsUpdate = a.status === "scheduled" && new Date(a.starts_at).getTime() < Date.now();
            return (
              <li key={a.id}>
                <Link href={`/appointments/${a.id}`} className="grid grid-cols-[4.5rem_1fr] gap-3 p-3 hover:bg-canvas sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:px-4">
                  <div className="text-center sm:text-start">
                    <div className="text-lg font-bold leading-tight"><Ltr>{formatTime(a.starts_at)}</Ltr></div>
                    <div className="text-[12px] text-ink-soft">
                      {range === "today" ? "היום" : <><span className="hidden sm:inline">{formatWeekday(a.starts_at)} </span><Ltr>{formatDate(a.starts_at)}</Ltr></>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.customers?.full_name}</div>
                    <div className="truncate text-sm text-ink-soft">
                      {a.treatments?.name}
                      {a.staff?.full_name && ` · ${a.staff.full_name}`}
                      <span className="hidden md:inline"> · <Ltr>{formatPhone(a.customers?.phone)}</Ltr></span>
                    </div>
                  </div>
                  <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-start-auto sm:justify-end">
                    <Chip tone={a.cancel_reason === "no_show" ? "red" : st.tone}>{a.cancel_reason ? label(cancelReason, a.cancel_reason) : st.label}</Chip>
                    {needsUpdate && <Chip tone="amber">לעדכן סטטוס</Chip>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
