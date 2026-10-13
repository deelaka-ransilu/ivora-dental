import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getSmsLog } from "@/db/owner-sms";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "SMS log" };

// The page is not async. The cookie read happens in the child, behind Suspense.
export default function SmsLogPage() {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <SmsLogContent />
    </Suspense>
  );
}

async function SmsLogContent() {
  const user = await requireRole(["owner"]);
  const rows = await getSmsLog(user);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-8 text-3xl font-medium tracking-tight">SMS sent (simulated)</h1>
      <p className="mt-1 text-sm opacity-80">
        Nothing is really sent in this demo. Each row is a message that would
        have gone out. Newest first, latest 200 shown.
      </p>
      <a
        href="/owner"
        className="mt-3 inline-flex min-h-11 items-center underline"
      >
        Back to schedule
      </a>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm">No simulated messages yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-5">
              <p className="text-sm font-semibold">
                Sent {formatDateTime(r.sentAt)}
              </p>
              <p className="mt-1 text-sm">
                To{" "}
                <a href={`tel:${r.toPhone}`} className="underline">
                  {r.toPhone}
                </a>
                {r.branchName && <span className="opacity-80"> · {r.branchName}</span>}
              </p>
              {r.appointmentStart && (
                <p className="text-sm opacity-80">
                  Appointment: {formatDateTime(r.appointmentStart)}
                </p>
              )}
              <p className="mt-2 text-sm">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
