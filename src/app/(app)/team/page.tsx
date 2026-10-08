import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui";
import { StaffRowForm, TreatmentRowForm } from "./forms";

export const metadata: Metadata = { title: "צוות והרשאות" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: staff }, { data: treatments }] = await Promise.all([
    supabase.from("staff").select("id, full_name, email, role, specialty, is_active").order("created_at"),
    supabase.from("treatments").select("id, name, price, duration_minutes, is_active").order("sort_order").order("id"),
  ]);

  return (
    <>
      <PageHeader title="צוות והרשאות" subtitle="מנהלת בלבד. שינוי תפקיד חל מיד, גם על מי שמחוברת כרגע." />

      <Section title="צוות">
        <div className="mb-3 grid gap-2 rounded-[10px] bg-muted p-3 text-[13px] text-ink-soft sm:grid-cols-3">
          <p><b className="text-ink">מנהלת:</b> הכל, כולל צוות, מחירון ומחיקה.</p>
          <p><b className="text-ink">מטפלת:</b> יצירה ועדכון של לקוחות, תורים וקריאות.</p>
          <p><b className="text-ink">צפייה בלבד:</b> רואה הכל, לא משנה דבר.</p>
        </div>
        {(staff ?? []).map((row) => (
          <StaffRowForm key={row.id} row={row} isMe={row.id === me.id} />
        ))}
        <p className="mt-3 text-[13px] text-ink-soft">
          הוספת משתמשת: בלוח הבקרה של Supabase (Authentication ← Add user). היא תופיע כאן כלא-פעילה בתפקיד &quot;צפייה בלבד&quot;, ומכאן מפעילים ומגדירים תפקיד.
        </p>
      </Section>

      <Section title="מחירון טיפולים" className="mt-4">
        {(treatments ?? []).map((row) => (
          <TreatmentRowForm key={row.id} row={row} />
        ))}
        <TreatmentRowForm />
      </Section>
    </>
  );
}
