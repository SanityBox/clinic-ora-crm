import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/nav";

export const metadata: Metadata = { title: "כניסה" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const inactive = sp.inactive === "1";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-xl font-bold">כניסה למערכת</h1>
          <p className="mb-5 text-sm text-ink-soft">לצוות קליניקת אורה בלבד</p>
          <LoginForm next={next} inactive={inactive} />
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-soft">אין הרשמה עצמית. משתמשת חדשה נוספת על ידי מנהלת.</p>
      </div>
    </main>
  );
}
