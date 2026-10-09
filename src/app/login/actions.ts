"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/errors";

// A path on this site: starts with one "/", no second "/" or "\" after it, no backslash or whitespace anywhere
const SAFE_PATH = /^\/(?![/\\])[^\\\s]*$/;

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

  // Only same-site paths. Browsers read "/\evil.com" as "//evil.com", so backslashes and control characters are refused too.
  redirect(SAFE_PATH.test(next) ? next : "/");
}
