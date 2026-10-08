"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { saveAppointment } from "./actions";
import { Field, FormError } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { CustomerPicker } from "@/components/customer-picker";
import type { CustomerOption } from "@/app/(app)/customers/actions";
import { appointmentStatus, cancelReason } from "@/lib/labels";
import { openingHoursWarning, shekel } from "@/lib/format";

export type Treatment = { id: number; name: string; price: number; duration_minutes: number };
export type StaffOption = { id: string; full_name: string };

export type AppointmentFormValues = {
  id?: string;
  customer: CustomerOption | null;
  treatment_id?: number;
  staff_id?: string | null;
  date: string;
  time: string;
  duration_minutes?: number;
  status?: string;
  cancel_reason?: string | null;
  notes?: string | null;
};

export function AppointmentForm({
  initial,
  treatments,
  staff,
  cancelHref,
  returnTo,
  readOnly,
}: {
  initial: AppointmentFormValues;
  treatments: Treatment[];
  staff: StaffOption[];
  cancelHref: string;
  returnTo?: string;
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(saveAppointment, null);
  const fe = state?.fieldErrors ?? {};
  const [treatmentId, setTreatmentId] = useState<number | "">(initial.treatment_id ?? "");
  const [duration, setDuration] = useState<number | "">(initial.duration_minutes ?? "");
  const [status, setStatus] = useState(initial.status ?? "scheduled");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  const treatment = treatments.find((t) => t.id === treatmentId);
  const hoursWarning = openingHoursWarning(date, time, Number(duration) || 0);

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <FormError message={state?.error} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Field label="לקוחה" htmlFor="customer_search" required error={fe.customer_id}>
          <CustomerPicker initial={initial.customer} error={fe.customer_id} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="סוג טיפול" htmlFor="treatment_id" required error={fe.treatment_id} hint={treatment && `${shekel(treatment.price)} · ${treatment.duration_minutes} דק'`}>
            <select
              id="treatment_id"
              name="treatment_id"
              className="input"
              value={treatmentId}
              aria-invalid={!!fe.treatment_id}
              onChange={(e) => {
                const id = Number(e.target.value) || "";
                setTreatmentId(id);
                const t = treatments.find((x) => x.id === id);
                if (t) setDuration(t.duration_minutes);
              }}
            >
              <option value="">בחירת טיפול</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="מטפלת" htmlFor="staff_id">
            <select id="staff_id" name="staff_id" className="input" defaultValue={initial.staff_id ?? ""}>
              <option value="">ללא שיוך</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תאריך" htmlFor="date" required error={fe.date}>
            <input id="date" name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!fe.date} />
          </Field>
          <Field label="שעה" htmlFor="time" required error={fe.time}>
            <input id="time" name="time" type="time" step={300} className="input" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!!fe.time} />
          </Field>
          <Field label="משך (דקות)" htmlFor="duration_minutes" required error={fe.duration_minutes} hint="מתמלא מהמחירון, אפשר לשנות">
            <input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={5}
              max={480}
              step={5}
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || "")}
              aria-invalid={!!fe.duration_minutes}
            />
          </Field>
          <Field label="סטטוס" htmlFor="status" required error={fe.status}>
            <select id="status" name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(appointmentStatus).map(([value, s]) => (
                <option key={value} value={value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {status === "cancelled" && (
            <Field label="סיבת ביטול" htmlFor="cancel_reason" required error={fe.cancel_reason}>
              <select id="cancel_reason" name="cancel_reason" className="input" defaultValue={initial.cancel_reason ?? ""} aria-invalid={!!fe.cancel_reason}>
                <option value="">בחירת סיבה</option>
                {Object.entries(cancelReason).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {hoursWarning && (
          <p className="flex items-center gap-2 rounded-[10px] bg-tone-amber-bg px-3 py-2 text-sm text-tone-amber" role="status">
            <AlertTriangle size={16} aria-hidden /> {hoursWarning}. אפשר לשמור בכל זאת.
          </p>
        )}

        <Field label="הערות" htmlFor="notes">
          <textarea id="notes" name="notes" rows={3} className="input py-2" defaultValue={initial.notes ?? ""} />
        </Field>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <SubmitButton>שמירה</SubmitButton>
          <Link href={cancelHref} className="btn btn-secondary">
            ביטול
          </Link>
        </div>
      )}
    </form>
  );
}
