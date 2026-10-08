"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 text-tone-amber" size={32} aria-hidden />
      <h1 className="mb-1 text-lg font-semibold">לא הצלחנו לטעון את המסך</h1>
      <p className="mb-4 text-sm text-ink-soft">ייתכן שיש בעיית חיבור. אפשר לנסות שוב.</p>
      <button className="btn btn-primary" onClick={() => reset()}>
        ניסיון נוסף
      </button>
    </div>
  );
}
