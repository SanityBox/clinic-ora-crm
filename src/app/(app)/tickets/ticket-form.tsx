"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveTicket } from "./actions";
import { Field, FormError } from "@/components/ui";
import { SubmitButton, submitKeepingFields } from "@/components/client";
import { CustomerPicker } from "@/components/customer-picker";
import type { CustomerOption } from "@/app/(app)/customers/actions";
import { ticketPriority, ticketSource, ticketStatus } from "@/lib/labels";

export type TicketFormValues = {
  id?: string;
  customer: CustomerOption | null;
  subject?: string | null;
  description?: string;
  status?: string;
  assignee_id?: string | null;
  priority?: string;
  source?: string | null;
};

export function TicketForm({
  initial,
  staff,
  cancelHref,
  readOnly,
}: {
  initial: TicketFormValues;
  staff: { id: string; full_name: string }[];
  cancelHref: string;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(saveTicket, null);
  const fe = state?.fieldErrors ?? {};
  const [status, setStatus] = useState(initial.status ?? "new");

  return (
    <form onSubmit={submitKeepingFields(action)} className="card flex flex-col gap-4 p-4 sm:p-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Field label="לקוחה" htmlFor="customer_search" required error={fe.customer_id}>
          <CustomerPicker initial={initial.customer} error={fe.customer_id} />
        </Field>
        <Field label="נושא" htmlFor="subject" hint="כותרת קצרה. אם ריק, יילקחו המילים הראשונות של התיאור.">
          <input id="subject" name="subject" className="input" maxLength={120} defaultValue={initial.subject ?? ""} />
        </Field>
        <Field label="תיאור הפנייה" htmlFor="description" required error={fe.description}>
          <textarea id="description" name="description" rows={4} className="input py-2" defaultValue={initial.description ?? ""} aria-invalid={!!fe.description} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="סטטוס" htmlFor="status" required error={fe.status}>
            <select id="status" name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ticketStatus).map(([v, s]) => (
                <option key={v} value={v}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="אחראית" htmlFor="assignee_id" required={status === "in_progress"} error={fe.assignee_id}>
            <select id="assignee_id" name="assignee_id" className="input" defaultValue={initial.assignee_id ?? ""} aria-invalid={!!fe.assignee_id}>
              <option value="">לא שויכה</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="עדיפות" htmlFor="priority" required>
            <select id="priority" name="priority" className="input" defaultValue={initial.priority ?? "normal"}>
              {Object.entries(ticketPriority).map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="מקור הפנייה" htmlFor="source">
            <select id="source" name="source" className="input" defaultValue={initial.source ?? ""}>
              <option value="">לא צוין</option>
              {Object.entries(ticketSource).map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <SubmitButton pending={pending}>שמירה</SubmitButton>
          <Link href={cancelHref} className="btn btn-secondary">ביטול</Link>
        </div>
      )}
    </form>
  );
}
