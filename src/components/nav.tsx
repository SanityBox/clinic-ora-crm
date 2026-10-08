"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, MessageSquareText, ShieldCheck, LogOut, Search } from "lucide-react";
import type { Role } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";

const items = [
  { href: "/", label: "ראשי", icon: LayoutDashboard },
  { href: "/customers", label: "לקוחות", icon: Users },
  { href: "/appointments", label: "תורים", icon: CalendarDays },
  { href: "/tickets", label: "קריאות שירות", short: "קריאות", icon: MessageSquareText },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#8e4a5e" />
        <circle cx="16" cy="16" r="8.5" fill="none" stroke="#e8d3a8" strokeWidth="2" />
        <circle cx="16" cy="16" r="3" fill="#fff" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold">אורה CRM</span>
        {!compact && <span className="block text-[12px] text-ink-soft">קליניקת אורה · רפואה אסתטית</span>}
      </span>
    </span>
  );
}

export function Sidebar({ name, role, signOut }: { name: string; role: Role; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-line bg-surface p-4 md:flex">
      <Link href="/" className="mb-6 px-2">
        <Logo />
      </Link>
      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${active ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink hover:bg-muted"}`}
            >
              <Icon size={19} aria-hidden />
              {label}
            </Link>
          );
        })}
        {role === "admin" && (
          <Link
            href="/team"
            aria-current={isActive(pathname, "/team") ? "page" : undefined}
            className={`mt-3 flex min-h-11 items-center gap-3 rounded-[10px] border-t border-line px-3 pt-3 text-[15px] ${isActive(pathname, "/team") ? "font-semibold text-brand-strong" : "text-ink hover:bg-muted"}`}
          >
            <ShieldCheck size={19} aria-hidden />
            צוות והרשאות
          </Link>
        )}
      </nav>
      <div className="border-t border-line pt-3">
        <div className="px-2 text-sm font-medium">{name}</div>
        <div className="px-2 text-[12px] text-ink-soft">{roleLabel[role]}</div>
        <form action={signOut}>
          <button className="btn btn-ghost mt-2 w-full justify-start text-ink-soft" type="submit">
            <LogOut size={17} aria-hidden /> יציאה
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileTopBar({ name, role, signOut }: { name: string; role: Role; signOut: () => Promise<void> }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
      <Link href="/" aria-label="מסך ראשי">
        <Logo compact />
      </Link>
      <details className="relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-[10px] px-2 text-sm text-ink-soft">
          {name.split(" ")[0]} ▾
        </summary>
        <div className="card absolute end-0 top-12 z-40 w-48 p-2">
          <div className="px-2 py-1 text-[12px] text-ink-soft">{roleLabel[role]}</div>
          {role === "admin" && (
            <Link href="/team" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
              <ShieldCheck size={17} aria-hidden /> צוות והרשאות
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
              <LogOut size={17} aria-hidden /> יציאה
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="ניווט ראשי" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, short, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] ${active ? "font-semibold text-brand" : "text-ink-soft"}`}
          >
            <Icon size={21} aria-hidden />
            {short ?? label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PhoneSearch() {
  return (
    <form action="/customers" role="search" className="relative w-full max-w-md">
      <input type="hidden" name="from" value="search" />
      <label htmlFor="global-search" className="sr-only">
        חיפוש לקוחה לפי טלפון או שם
      </label>
      <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
      <input
        id="global-search"
        name="q"
        type="search"
        inputMode="search"
        placeholder="חיפוש לפי טלפון או שם"
        className="input ps-10"
        autoComplete="off"
      />
    </form>
  );
}
