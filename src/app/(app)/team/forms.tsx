"use client";

import { useActionState } from "react";
import { saveTreatment, updateStaff } from "./actions";
import { roleLabel } from "@/lib/labels";
import { SubmitButton } from "@/components/client";

type StaffRow = { id: string; full_name: string; email: string; role: string; specialty: string | null; is_active: boolean };
type TreatmentRow = { id: number; name: string; price: number; duration_minutes: number; is_active: boolean };

function Saved({ state }: { state: { error?: string } | null }) {
  if (!state) return null;
  return state.error ? (
    <p className="text-[13px] text-tone-red" role="alert">{state.error}</p>
  ) : (
    <p className="text-[13px] text-tone-green" role="status">נשמר</p>
  );
}

export function StaffRowForm({ row, isMe }: { row: StaffRow; isMe: boolean }) {
  const [state, action] = useActionState(updateStaff, null);
  return (
    <form action={action} className="grid gap-3 border-b border-line py-3 last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] sm:items-center">
      <input type="hidden" name="id" value={row.id} />
      <div className="min-w-0">
        <div className="font-medium">
          {row.full_name} {isMe && <span className="text-[13px] text-ink-soft">(את)</span>}
        </div>
        <bdi className="ltr block truncate text-[13px] text-ink-soft">{row.email}</bdi>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-ink-soft">
        תפקיד
        <select name="role" defaultValue={row.role} className="input text-ink" disabled={isMe}>
          {Object.entries(roleLabel).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
        {isMe && <input type="hidden" name="role" value={row.role} />}
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-soft">
        התמחות
        <input name="specialty" defaultValue={row.specialty ?? ""} className="input text-ink" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={row.is_active} disabled={isMe} className="size-5 accent-brand" />
        {isMe && <input type="hidden" name="is_active" value="on" />}
        פעילה
      </label>
      <div className="flex flex-col items-start gap-1">
        <SubmitButton className="btn btn-secondary min-h-10 text-sm">שמירה</SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}

export function TreatmentRowForm({ row }: { row?: TreatmentRow }) {
  const [state, action] = useActionState(saveTreatment, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 border-b border-line py-3 last:border-0 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-end">
      {row && <input type="hidden" name="id" value={row.id} />}
      <label className="col-span-2 flex flex-col gap-1 text-[13px] text-ink-soft sm:col-span-1">
        שם הטיפול
        <input name="name" defaultValue={row?.name} required className="input text-ink" placeholder={row ? undefined : "טיפול חדש"} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-soft">
        מחיר (₪)
        <input name="price" type="number" min={0} step={10} defaultValue={row?.price} required className="input text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-soft">
        משך (דק&apos;)
        <input name="duration_minutes" type="number" min={5} max={480} step={5} defaultValue={row?.duration_minutes} required className="input text-ink" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? true} className="size-5 accent-brand" />
        פעיל
      </label>
      <div className="flex flex-col items-start gap-1">
        <SubmitButton className="btn btn-secondary min-h-10 text-sm">{row ? "שמירה" : "הוספה"}</SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}
