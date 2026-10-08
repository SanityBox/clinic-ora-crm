"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/errors";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = str(formData, "next");

  if (!email || !password) {
    return { error: "יש למלא אימייל וסיסמה" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "האימייל או הסיסמה שגויים" };
  }

  const { data: staff } = await supabase.from("staff").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!staff?.is_active) {
    await supabase.auth.signOut();
    return { error: "המשתמשת אינה פעילה, יש לפנות לרותם" };
  }

  // Only same-site paths, never an absolute URL from the query string
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
