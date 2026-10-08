import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, MobileTopBar, PhoneSearch, Sidebar } from "@/components/nav";
import { Toast } from "@/components/client";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login?inactive=1");

  return (
    <div className="flex min-h-dvh">
      <Sidebar name={staff.fullName} role={staff.role} signOut={signOut} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar name={staff.fullName} role={staff.role} signOut={signOut} />
        <div className="border-b border-line bg-surface/60 px-4 py-3 md:px-8">
          <PhoneSearch />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10">{children}</main>
      </div>
      <BottomNav />
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
