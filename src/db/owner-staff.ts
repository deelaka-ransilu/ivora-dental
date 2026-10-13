// Owner staff logins (O4). Owner only. Server only.
// Lists logins, creates receptionist and dentist logins, and deactivates or
// reactivates them. Nothing is deleted. Passwords are never read back.

import { getSupabase } from "@/lib/supabase-server";
import type { CurrentUser, Role } from "@/lib/auth";

// DEMO ONLY: new logins must use this fake domain. Remove this check for a real install.
export const DEMO_EMAIL_DOMAIN = "@ivora-demo.test";
const MAX_LOGINS = 15;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffLogin = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  branchName: string;
  dentistName: string;
};

export type FreeDentist = { id: string; fullName: string };

export type CreateResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "name"
        | "email"
        | "domain"
        | "password"
        | "role"
        | "branch"
        | "dentist"
        | "exists"
        | "limit"
        | "server";
    };

export type ToggleResult =
  | { ok: true }
  | { ok: false; error: "self" | "owner" | "notfound" | "server" };

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ownerOnly(user: CurrentUser): void {
  if (user.role !== "owner") {
    throw new Error("Not allowed: staff logins need the owner login.");
  }
}

const ROLE_ORDER: Record<Role, number> = {
  owner: 0,
  receptionist: 1,
  dentist: 2,
};

export async function getStaffLogins(user: CurrentUser): Promise<StaffLogin[]> {
  ownerOnly(user);

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

// Active dentists who do not have a login yet.
export async function getFreeDentists(
  user: CurrentUser
): Promise<FreeDentist[]> {
  ownerOnly(user);
  const db = getSupabase();
  const [dentistRes, linkedRes] = await Promise.all([
    db
      .from("dentists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
    db.from("profiles").select("dentist_id").not("dentist_id", "is", null),
  ]);
  if (dentistRes.error) throw new Error(dentistRes.error.message);
  if (linkedRes.error) throw new Error(linkedRes.error.message);

  const linked = new Set(
    (linkedRes.data as { dentist_id: string }[]).map((r) => r.dentist_id)
  );
  return (dentistRes.data as { id: string; full_name: string }[])
    .filter((d) => !linked.has(d.id))
    .map((d) => ({ id: d.id, fullName: d.full_name }));
}

// Creates the sign-in and its profile row. If the profile fails, the sign-in is removed again.
export async function createStaffLogin(
  user: CurrentUser,
  raw: Record<string, string>
): Promise<CreateResult> {
  ownerOnly(user);

  const fullName = (raw.fullName ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  const roleRaw = raw.role ?? "";
  const role =
    roleRaw === "receptionist"
      ? "receptionist"
      : roleRaw === "dentist"
        ? "dentist"
        : null;

  if (fullName.length < 2 || fullName.length > 80) {
    return { ok: false, error: "name" };
  }
  if (!EMAIL.test(email)) return { ok: false, error: "email" };
  if (!email.endsWith(DEMO_EMAIL_DOMAIN)) return { ok: false, error: "domain" };
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "password" };
  }
  if (!role) return { ok: false, error: "role" };

  const db = getSupabase();
  let branchId: string | null = null;
  let dentistId: string | null = null;

  if (role === "receptionist") {
    const id = raw.branchId ?? "";
    if (!UUID.test(id)) return { ok: false, error: "branch" };
    const res = await db.from("branches").select("id").eq("id", id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) return { ok: false, error: "branch" };
    branchId = id;
  } else {
    const id = raw.dentistId ?? "";
    if (!UUID.test(id)) return { ok: false, error: "dentist" };
    const [dRes, pRes] = await Promise.all([
      db.from("dentists").select("id").eq("id", id).maybeSingle(),
      db.from("profiles").select("id").eq("dentist_id", id).maybeSingle(),
    ]);
    if (dRes.error) throw new Error(dRes.error.message);
    if (pRes.error) throw new Error(pRes.error.message);
    if (!dRes.data || pRes.data) return { ok: false, error: "dentist" };
    dentistId = id;
  }

  const countRes = await db
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (countRes.error) throw new Error(countRes.error.message);
  if ((countRes.count ?? 0) >= MAX_LOGINS) return { ok: false, error: "limit" };

  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    if (
      created.error &&
      (created.error.code === "email_exists" || created.error.status === 422)
    ) {
      return { ok: false, error: "exists" };
    }
    console.error("create login failed:", created.error?.message);
    return { ok: false, error: "server" };
  }
  const newId = created.data.user.id;

  const ins = await db.from("profiles").insert({
    id: newId,
    full_name: fullName,
    role,
    branch_id: branchId,
    dentist_id: dentistId,
    is_active: true,
  });
  if (ins.error) {
    console.error("profile insert failed:", ins.error.message);
    await db.auth.admin.deleteUser(newId);
    return { ok: false, error: "server" };
  }

  return { ok: true };
}

// Deactivate or reactivate a login. Not yourself, not the owner.
export async function setStaffActive(
  user: CurrentUser,
  id: string,
  isActive: boolean
): Promise<ToggleResult> {
  ownerOnly(user);
  if (!UUID.test(id)) return { ok: false, error: "notfound" };
  if (id === user.id) return { ok: false, error: "self" };

  const db = getSupabase();
  const found = await db
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (!found.data) return { ok: false, error: "notfound" };
  if ((found.data as { role: Role }).role === "owner") {
    return { ok: false, error: "owner" };
  }

  const res = await db
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id");
  if (res.error) {
    console.error("login update failed:", res.error.message);
    return { ok: false, error: "server" };
  }
  if ((res.data?.length ?? 0) === 0) return { ok: false, error: "notfound" };
  return { ok: true };
}
