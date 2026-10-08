import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, Plus, UserRoundSearch, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { customerSearchFilter } from "@/lib/search";
import { formatDate, formatPhone, normalizePhone } from "@/lib/format";
import { customerSource, label } from "@/lib/labels";
import { Chip, EmptyState, Ltr, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "לקוחות" };

const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const fromSearch = sp.from === "search";

  const supabase = await createClient();
  let query = supabase
    .from("customer_overview")
    .select("id, full_name, phone, source, next_appointment_at, next_treatment, open_tickets, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const filter = customerSearchFilter(q);
  if (filter) query = query.or(filter);
  const { data: customers, count, error } = await query;
  if (error) throw new Error(error.message);

  // Header search with a full phone number that matches exactly one card goes straight to it (PRD 4.2)
  const exactPhone = normalizePhone(q);
  if (fromSearch && exactPhone && customers?.length === 1 && customers[0].phone === exactPhone) {
    redirect(`/customers/${customers[0].id}`);
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const newHref = exactPhone ? `/customers/new?phone=${exactPhone}` : "/customers/new";

  return (
    <>
      <PageHeader
        title="לקוחות"
        subtitle={q ? `${total} תוצאות עבור "${q}"` : `${total} לקוחות`}
        actions={
          staff.canWrite && (
            <Link href={newHref} className="btn btn-primary">
              <Plus size={18} aria-hidden /> לקוחה חדשה
            </Link>
          )
        }
      />

      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="customers-q" className="sr-only">
          חיפוש לפי טלפון או שם
        </label>
        <input id="customers-q" name="q" type="search" defaultValue={q} placeholder="טלפון (גם 4 ספרות אחרונות) או שם" className="input" />
        <button className="btn btn-secondary" type="submit">
          חיפוש
        </button>
      </form>

      {!customers?.length ? (
        <div className="card">
          {q ? (
            <EmptyState
              icon={<UserRoundSearch size={32} />}
              title="לא נמצאה לקוחה עם הטלפון או השם האלה"
              text="אפשר לבדוק את המספר, או ליצור כרטיס חדש."
              action={
                staff.canWrite && (
                  <Link href={newHref} className="btn btn-primary">
                    יצירת לקוחה חדשה
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState icon={<Users size={32} />} title="עוד אין לקוחות במערכת" text="כל פנייה חדשה מתחילה בכרטיס לקוחה." action={staff.canWrite && <Link href="/customers/new" className="btn btn-primary">לקוחה ראשונה</Link>} />
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-2.5 text-start font-medium">שם</th>
                  <th className="px-4 py-2.5 text-start font-medium">טלפון</th>
                  <th className="px-4 py-2.5 text-start font-medium">התור הבא</th>
                  <th className="px-4 py-2.5 text-start font-medium">קריאות פתוחות</th>
                  <th className="px-4 py-2.5 text-start font-medium">מקור</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-line hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Ltr>{formatPhone(c.phone)}</Ltr>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.next_appointment_at ? (
                        <>
                          <Ltr>{formatDate(c.next_appointment_at)}</Ltr> · {c.next_treatment}
                        </>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{c.open_tickets ? <Chip tone="amber">{c.open_tickets}</Chip> : <span className="text-ink-soft">0</span>}</td>
                    <td className="px-4 py-3 text-sm text-ink-soft">{label(customerSource, c.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {customers.map((c) => (
              <li key={c.id} className="card flex items-center gap-3 p-3">
                <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.full_name}</div>
                  <div className="text-sm text-ink-soft">
                    <Ltr>{formatPhone(c.phone)}</Ltr>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[13px] text-ink-soft">
                    {c.next_appointment_at && (
                      <span>
                        תור: <Ltr>{formatDate(c.next_appointment_at)}</Ltr>
                      </span>
                    )}
                    {(c.open_tickets ?? 0) > 0 && <Chip tone="amber">{c.open_tickets} פתוחות</Chip>}
                  </div>
                </Link>
                <a href={`tel:${c.phone}`} className="btn btn-secondary size-11 shrink-0 px-0" aria-label={`חיוג ל${c.full_name}`}>
                  <Phone size={18} aria-hidden />
                </a>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-center gap-2" aria-label="עמודים">
              {page > 1 && (
                <Link className="btn btn-secondary" href={`/customers?${new URLSearchParams({ q, page: String(page - 1) })}`}>
                  הקודם
                </Link>
              )}
              <span className="text-sm text-ink-soft">
                עמוד {page} מתוך {pages}
              </span>
              {page < pages && (
                <Link className="btn btn-secondary" href={`/customers?${new URLSearchParams({ q, page: String(page + 1) })}`}>
                  הבא
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
