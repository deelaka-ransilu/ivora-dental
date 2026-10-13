"use server";

// Owner setup actions (O2). Every action checks the role first.

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  countFutureForDentist,
  countOutsideHours,
  getHoursRow,
  updateDentist,
  updateHours,
  updateService,
} from "@/db/owner-setup";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function go(params: Record<string, string>): never {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "")
  );
  redirect(`/owner/setup?${q.toString()}`);
}

export async function saveDentist(formData: FormData) {
  const user = await requireRole(["owner"]);

  const id = field(formData, "id");
  const fullName = field(formData, "fullName");
  const isActive = formData.get("isActive") === "on";
  const confirm = formData.get("confirm") === "on";

  if (!UUID.test(id)) go({ error: "server" });
  if (fullName.length < 2 || fullName.length > 80) go({ error: "name" });

  // Switching a dentist off: existing bookings stay, so ask first if there are any.
  if (!isActive) {
    const n = await countFutureForDentist(user, id);
    if (n > 0 && !confirm) go({ error: "confirm", n: String(n) });
  }

  const ok = await updateDentist(user, id, fullName, isActive);
  if (!ok) go({ error: "server" });
  go({ saved: "1" });
}

export async function saveService(formData: FormData) {
  const user = await requireRole(["owner"]);

  const id = field(formData, "id");
  const name = field(formData, "name");
  const duration = Number(field(formData, "duration"));

  if (!UUID.test(id)) go({ error: "server" });
  if (name.length < 2 || name.length > 80) go({ error: "name" });
  if (!Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5 !== 0) {
    go({ error: "duration" });
  }

  const ok = await updateService(user, id, name, duration);
  if (!ok) go({ error: "server" });
  go({ saved: "1" });
}

export async function saveHours(formData: FormData) {
  const user = await requireRole(["owner"]);

  const id = field(formData, "id");
  const startTime = field(formData, "startTime");
  const endTime = field(formData, "endTime");
  const confirm = formData.get("confirm") === "on";

  if (!UUID.test(id)) go({ error: "server" });
  if (!TIME.test(startTime) || !TIME.test(endTime)) go({ error: "time" });
  if (toMin(endTime) <= toMin(startTime)) go({ error: "order" });

  const row = await getHoursRow(user, id);
  if (!row) go({ error: "server" });

  // Future bookings that would fall outside the new hours are kept, but ask first.
  const n = await countOutsideHours(user, row, startTime, endTime);
  if (n > 0 && !confirm) go({ error: "confirm", n: String(n) });

  const ok = await updateHours(user, id, startTime, endTime);
  if (!ok) go({ error: "server" });
  go({ saved: "1" });
}
