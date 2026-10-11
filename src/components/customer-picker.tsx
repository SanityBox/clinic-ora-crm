"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { searchCustomers, type CustomerOption } from "@/app/(app)/customers/actions";
import { formatPhone } from "@/lib/format";

/** The "new customer" link fills the field that matches what was typed (same test as customerSearchFilter). */
function newCustomerHref(q: string): string {
  const text = q.trim();
  return `/customers/new?${/^[\d\s\-+().]+$/.test(text) ? "phone" : "name"}=${encodeURIComponent(text)}`;
}

/** Choose the customer of an appointment or ticket by phone or name (BR-03, BR-04). */
export function CustomerPicker({ initial, error }: { initial: CustomerOption | null; error?: string }) {
  const [selected, setSelected] = useState<CustomerOption | null>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [more, setMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = useCallback((query: string) => {
    startTransition(async () => {
      const r = await searchCustomers(query);
      setResults(r.customers);
      setMore(r.more);
      setSearched(true);
    });
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      // Clearing stale results when the query gets too short; the alternative (deriving) would hide a pending search.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(() => run(q), 250);
    return () => clearTimeout(timer.current);
  }, [q, run]);

  // A customer created in another tab (the "new customer" link opens one) shows up on return, without a refresh.
  useEffect(() => {
    if (selected || q.trim().length < 2) return;
    const again = () => {
      if (document.visibilityState === "visible") run(q);
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [q, selected, run]);

  if (selected) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] border border-line bg-brand-soft/50 px-3">
        <input type="hidden" name="customer_id" value={selected.id} />
        <span>
          <span className="font-medium">{selected.full_name}</span>{" "}
          <bdi className="ltr text-sm text-ink-soft">{formatPhone(selected.phone)}</bdi>
        </span>
        <button type="button" className="btn btn-ghost min-h-11 text-sm" onClick={() => setSelected(null)}>
          <X size={15} aria-hidden /> החלפה
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="hidden" name="customer_id" value="" />
      <Search size={17} className="pointer-events-none absolute start-3 top-3.5 text-ink-soft" aria-hidden />
      <input
        id="customer_search"
        type="search"
        className="input ps-9"
        placeholder="הקלדת טלפון או שם"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? "customer_search-error" : undefined}
        autoComplete="off"
      />
      {(results.length > 0 || (searched && !pending)) && (
        <ul className="card absolute inset-x-0 top-12 z-20 max-h-72 overflow-auto p-1" role="listbox">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-start hover:bg-muted"
                onClick={() => {
                  setSelected(c);
                  setQ("");
                }}
              >
                <span className="font-medium">{c.full_name}</span>
                <bdi className="ltr text-sm text-ink-soft">{formatPhone(c.phone)}</bdi>
              </button>
            </li>
          ))}
          {more && (
            <li className="px-3 py-2 text-sm text-ink-soft">יש עוד תוצאות. כדאי להקליד עוד מהשם או מהטלפון.</li>
          )}
          {searched && !pending && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-soft">
              לא נמצאה לקוחה.{" "}
              <a href={newCustomerHref(q)} target="_blank" rel="noopener" className="font-medium text-brand underline">
                יצירת לקוחה חדשה
              </a>{" "}
              (נפתחת בלשונית חדשה, וכשחוזרים לכאן היא מופיעה בחיפוש)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
