"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { saveCustomer } from "./actions";
import { Field, FormError } from "@/components/ui";
import { SubmitButton, submitKeepingFields } from "@/components/client";
import { customerSource } from "@/lib/labels";
import { sendPick, type PickedCustomer } from "@/lib/customer-pick";

export type CustomerFormValues = {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  source?: string | null;
  marketing_consent?: boolean;
  notes?: string | null;
};

export function CustomerForm({ initial, cancelHref, pickToken }: { initial: CustomerFormValues; cancelHref: string; pickToken?: string }) {
  const [state, action, pending] = useActionState(saveCustomer, null);
  const fe = state?.fieldErrors ?? {};
  const [pickedExisting, setPickedExisting] = useState<PickedCustomer | null>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const picked = state?.picked ?? pickedExisting;

  // stage 37: tell the form that opened this tab which customer to select, then close the tab
  useEffect(() => {
    if (!picked || !pickToken) return;
    sendPick({ token: pickToken, customer: picked });
    window.close();
    // still open after a moment: browsers let a script close only a tab that a script opened
    const t = setTimeout(() => setCloseBlocked(true), 400);
    return () => clearTimeout(t);
  }, [picked, pickToken]);

  if (picked && pickToken) {
    return (
      <div className="card p-4 sm:p-6" role="status">
        {closeBlocked ? (
          <>
            הלקוחה נשמרה ונבחרה בטופס. אפשר לסגור את הלשונית הזו.{" "}
            <Link href={`/customers/${picked.id}`} className="font-medium text-brand underline">
              לכרטיס הלקוחה
            </Link>
          </>
        ) : (
          "הלקוחה נבחרה בטופס…"
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submitKeepingFields(action)} className="card flex flex-col gap-4 p-4 sm:p-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {pickToken && <input type="hidden" name="pick" value={pickToken} />}
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
                    {pickToken && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className="font-medium underline"
                          onClick={() => {
                            const c = state.existingCustomer!;
                            setPickedExisting({ id: c.id, full_name: c.name, phone: c.phone ?? "" });
                          }}
                        >
                          לבחור אותה בטופס
                        </button>
                      </>
                    )}
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
        <SubmitButton pending={pending}>שמירה</SubmitButton>
        <Link href={cancelHref} className="btn btn-secondary">
          ביטול
        </Link>
      </div>
    </form>
  );
}
