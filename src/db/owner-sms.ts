// Owner SMS log (5c). Owner only. Server only. Read-only.
// Messages are simulated: nothing is really sent.

import { getSupabase } from "@/lib/supabase-server";
import type { CurrentUser } from "@/lib/auth";

export type SmsRow = {
  id: string;
  sentAt: string;
  toPhone: string;
  message: string;
  branchName: string;
  appointmentStart: string | null;
};

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// Newest first. Limited to the latest 200 messages.
export async function getSmsLog(user: CurrentUser): Promise<SmsRow[]> {
  if (user.role !== "owner") {
    throw new Error("Not allowed: the SMS log needs the owner login.");
  }

  const res = await getSupabase()
    .from("sms_log")
    .select(
      "id, created_at, to_phone, message, appointments(start_at, branches(name))"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (res.error) throw new Error(res.error.message);

  type Row = {
    id: string;
    created_at: string;
    to_phone: string;
    message: string;
    appointments:
      | { start_at: string; branches: { name: string } | { name: string }[] | null }
      | { start_at: string; branches: { name: string } | { name: string }[] | null }[]
      | null;
  };

  return (res.data as unknown as Row[]).map((r) => {
    const appt = first(r.appointments);
    return {
      id: r.id,
      sentAt: r.created_at,
      toPhone: r.to_phone,
      message: r.message,
      branchName: first(appt?.branches)?.name ?? "",
      appointmentStart: appt?.start_at ?? null,
    };
  });
}
