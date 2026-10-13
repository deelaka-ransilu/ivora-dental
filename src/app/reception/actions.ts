"use server";

// Reception actions. Every action checks the role first (architecture rule 2).

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { cancelBranchBooking } from "@/db/reception";
import { colomboDateString, isColomboDate } from "@/lib/format";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function cancelBooking(formData: FormData) {
  const user = await requireRole(["receptionist"]);

  const id = field(formData, "id");
  const rawDate = field(formData, "date");
  const date = isColomboDate(rawDate) ? rawDate : colomboDateString();

  await cancelBranchBooking(user, id);

  redirect(`/reception?date=${date}`);
}
