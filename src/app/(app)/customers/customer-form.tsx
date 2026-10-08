"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCustomer } from "./actions";
import { Field, FormError } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { customerSource } from "@/lib/labels";

export type CustomerFormValues = {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  source?: string | null;
  marketing_consent?: boolean;
  notes?: string | null;
};

export function CustomerForm({ initial, cancelHref }: { initial: CustomerFormValues; cancelHref: string }) {
  const [state, action] = useActionState(saveCustomer, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם מלא" htmlFor="full_name" required error={fe.full_name}>
          <input id="full_name" name="full_name" className="input" defaultValue={initial.full_name} required minLength={2} aria-invalid={!!fe.full_name} autoComplete="off" />
        </Field>
        <Field
          label="טלפון"
          htmlFor="phone"
          required
          hint="נייד או קווי, בכל פורמט"
          error={
            fe.phone && (
              <>
                {fe.phone}
                {state?.existingCustomer && (
                  <>
                    {" · "}
                    <Link href={`/customers/${state.existingCustomer.id}`} className="font-medium underline">
                      מעבר לכרטיס
                    </Link>
                  </>
                )}
              </>
            )
          }
        >
          <input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" className="input text-start" defaultValue={initial.phone} required aria-invalid={!!fe.phone} placeholder="054-7821390" autoComplete="off" />
        </Field>
        <Field label="אימייל" htmlFor="email" error={fe.email}>
          <input id="email" name="email" type="email" dir="ltr" className="input text-start" defaultValue={initial.email ?? ""} aria-invalid={!!fe.email} autoComplete="off" />
        </Field>
        <Field label="מקור הגעה" htmlFor="source" error={fe.source}>
          <select id="source" name="source" className="input" defaultValue={initial.source ?? ""}>
            <option value="">לא ידוע</option>
            {Object.entries(customerSource).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="הערות" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} className="input py-2" defaultValue={initial.notes ?? ""} />
      </Field>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="marketing_consent" defaultChecked={initial.marketing_consent} className="size-5 accent-brand" />
        הלקוחה הסכימה לקבל דיוור ועדכונים
      </label>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <SubmitButton>שמירה</SubmitButton>
        <Link href={cancelHref} className="btn btn-secondary">
          ביטול
        </Link>
      </div>
    </form>
  );
}
