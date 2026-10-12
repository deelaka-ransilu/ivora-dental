import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-server";

export type Role = "owner" | "receptionist" | "dentist";

export type CurrentUser = {
  id: string;
  fullName: string;
  role: Role;
  branchId: string | null;
  dentistId: string | null;
};

const COOKIE_NAME = "ivora_session";

type SignInResult =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false };

// Signs in with email + password. Uses a separate short-lived client on purpose:
// signing in on the shared secret-key client would make it act as that user
// and lose its database access.
export async function signInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }

  const temp = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await temp.auth.signInWithPassword({ email, password });
  if (error || !data.session) return { ok: false };

  return {
    ok: true,
    accessToken: data.session.access_token,
    expiresIn: data.session.expires_in,
  };
}

// Call these only from server actions or route handlers (cookies can't be set while rendering).
export async function setSession(accessToken: string, expiresIn: number) {
  const store = await cookies();
  store.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Returns the signed-in user with their role, or null.
// cache() makes repeated calls in one request hit Supabase only once.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = getSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, branch_id, dentist_id, is_active")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) return null;

  return {
    id: profile.id as string,
    fullName: profile.full_name as string,
    role: profile.role as Role,
    branchId: (profile.branch_id as string | null) ?? null,
    dentistId: (profile.dentist_id as string | null) ?? null,
  };
});

// Every protected page and server action starts with this.
// Not signed in, or the wrong role: sent to the login page.
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !allowed.includes(user.role)) {
    redirect("/login");
  }
  return user;
}