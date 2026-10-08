"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Field, FormError } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export function LoginForm({ next, inactive }: { next: string; inactive: boolean }) {
  const [state, action] = useActionState(signIn, inactive ? { error: "המשתמשת אינה פעילה או שהחיבור פג. יש להיכנס מחדש." } : null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <Field label="אימייל" htmlFor="email" required>
        <input id="email" name="email" type="email" autoComplete="username" dir="ltr" className="input text-start" required autoFocus />
      </Field>
      <Field label="סיסמה" htmlFor="password" required>
        <input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" className="input text-start" required />
      </Field>
      <SubmitButton className="btn btn-primary w-full" pendingText="נכנסת…">
        כניסה
      </SubmitButton>
    </form>
  );
}
