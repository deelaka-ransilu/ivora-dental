"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createStaffLogin, setStaffActive } from "@/db/owner-staff";

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function addStaff(formData: FormData) {
  const user = await requireRole(["owner"]);
  const result = await createStaffLogin(user, {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    role: field(formData, "role"),
    branchId: field(formData, "branchId"),
    dentistId: field(formData, "dentistId"),
  });
  if (!result.ok) redirect(`/owner/staff?error=${result.error}`);
  redirect("/owner/staff?created=1");
}

export async function toggleStaff(formData: FormData) {
  const user = await requireRole(["owner"]);
  const result = await setStaffActive(
    user,
    field(formData, "id"),
    field(formData, "active") === "1"
  );
  if (!result.ok) redirect(`/owner/staff?error=${result.error}`);
  redirect("/owner/staff?updated=1");
}
