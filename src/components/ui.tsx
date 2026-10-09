import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const toneClass: Record<Tone, string> = {
  blue: "bg-tone-blue-bg text-tone-blue",
  amber: "bg-tone-amber-bg text-tone-amber",
  green: "bg-tone-green-bg text-tone-green",
  gray: "bg-tone-gray-bg text-tone-gray",
  red: "bg-tone-red-bg text-tone-red",
  brand: "bg-brand-soft text-brand-strong",
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-brand">
          → {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-ink-soft">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icon && <div className="text-ink-soft">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-tone-red" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-ink-soft">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] text-tone-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-[10px] border border-tone-red/30 bg-tone-red-bg px-3 py-2 text-sm text-tone-red">
      {message}
    </div>
  );
}

export function Ltr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <bdi className={`ltr ${className}`}>{children}</bdi>;
}

export function Stat({ label, value, tone, href, hint }: { label: string; value: ReactNode; tone?: Tone; href?: string; hint?: string }) {
  const body = (
    <div className={`card h-full p-4 transition-colors ${href ? "hover:border-brand" : ""}`}>
      <div className="text-[13px] text-ink-soft">{label}</div>
      <div className={`mt-1 text-[28px] font-bold leading-none ${tone === "red" ? "text-tone-red" : tone === "amber" ? "text-tone-amber" : ""}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[12px] text-ink-soft">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
