// Owner staff logins (O4, read-only). Owner only. Server only.
// Lists who can sign in and with which role. No passwords are ever read.
// Creating and removing logins from the browser is NOT built (see README).

import { getSupabase } from "@/lib/supabase-server";
import type { CurrentUser, Role } from "@/lib/auth";

export type StaffLogin = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  branchName: string;
  dentistName: string;
};

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ROLE_ORDER: Record<Role, number> = {
  owner: 0,
  receptionist: 1,
  dentist: 2,
};

export async function getStaffLogins(user: CurrentUser): Promise<StaffLogin[]> {
  if (user.role !== "owner") {
    throw new Error("Not allowed: staff logins need the owner login.");
  }

  const db = getSupabase();
  const [profilesRes, usersRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, role, is_active, branches(name), dentists(full_name)"),
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (usersRes.error) throw new Error(usersRes.error.message);

  const emailById = new Map<string, string>();
  for (const u of usersRes.data.users) {
    emailById.set(u.id, u.email ?? "");
  }

  type Row = {
    id: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    branches: { name: string } | { name: string }[] | null;
    dentists: { full_name: string } | { full_name: string }[] | null;
  };

  return (profilesRes.data as unknown as Row[])
    .map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: emailById.get(r.id) ?? "",
      role: r.role,
      isActive: r.is_active,
      branchName: first(r.branches)?.name ?? "",
      dentistName: first(r.dentists)?.full_name ?? "",
    }))
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.fullName.localeCompare(b.fullName)
    );
}
