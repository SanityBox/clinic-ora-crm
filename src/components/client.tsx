"use client";

import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

// <form action={fn}> makes React 19 reset the form after every submit, which wipes what the user typed
// when validation fails and desyncs controlled selects. Submitting through onSubmit keeps the fields;
// pass useActionState's isPending to SubmitButton, since useFormStatus doesn't see this path.
export function submitKeepingFields(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "שומרת…", pending: pendingProp }: { children: ReactNode; className?: string; pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

const toastText: Record<string, { text: string; kind: "ok" | "warn" }> = {
  customer_saved: { text: "הלקוחה נשמרה", kind: "ok" },
  customer_deleted: { text: "הלקוחה נמחקה", kind: "ok" },
  appointment_saved: { text: "התור נשמר", kind: "ok" },
  ticket_saved: { text: "הקריאה נשמרה", kind: "ok" },
  team_saved: { text: "השינוי נשמר", kind: "ok" },
  no_permission: { text: "אין הרשאה לפעולה הזו", kind: "warn" },
  incident_resolved: { text: "התקלה סומנה כמטופלת", kind: "ok" },
  save_failed: { text: "משהו השתבש והשינוי לא נשמר. אפשר לנסות שוב.", kind: "warn" },
};

/** Success messages after a redirect: actions append ?toast=<key>, this shows it for 3 seconds and cleans the URL. */
export function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("toast");
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    // Syncing from the URL (an external system) is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(key);
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const t = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(t);
  }, [key, params, pathname, router]);

  const item = shown ? toastText[shown] : null;
  if (!item) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${item.kind === "ok" ? "bg-tone-green" : "bg-tone-amber"}`}
        style={{ animation: "toast-in 180ms ease-out" }}
      >
        {item.kind === "ok" ? <CheckCircle2 size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
        {item.text}
      </div>
    </div>
  );
}

/** A destructive submit that asks first and names the record (PRD 11.2). */
export function ConfirmSubmit({ message, children, className = "btn btn-danger" }: { message: string; children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "מוחקת…" : children}
    </button>
  );
}
