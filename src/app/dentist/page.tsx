import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getOwnDentistBookings } from "@/db/dentist";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  formatDate,
  formatTime,
  isColomboDate,
} from "@/lib/format";

export const metadata: Metadata = { title: "My bookings" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const linkButton = "btn btn-light min-h-11";

// The page is not async. Cookies and searchParams are read in the child
// component, behind Suspense, as Cache Components requires.
export default function DentistPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">Loading...</p>}>
      <DentistContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DentistContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["dentist"]);

  const p = await searchParams;
  const raw = one(p.date);
  const today = colomboDateString();
  const date = isColomboDate(raw) ? raw : today;

  const bookings = await getOwnDentistBookings(user, date);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-8 text-3xl font-medium tracking-tight">My bookings</h1>
      <p className="mt-1 text-sm text-muted">
        {formatDate(colomboToDate(date, "12:00"))}: {bookings.length} booked
        (all branches)
      </p>
      <p className="mt-1 text-sm text-muted">
        Read-only. To change a booking, please ask reception.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <a
          href={`/dentist?date=${addDaysToColomboDate(date, -1)}`}
          className={linkButton}
        >
          Previous day
        </a>
        <a href="/dentist" className={linkButton}>
          Today
        </a>
        <a
          href={`/dentist?date=${addDaysToColomboDate(date, 1)}`}
          className={linkButton}
        >
          Next day
        </a>
      </div>

      <form
        method="get"
        action="/dentist"
        className="mt-3 flex flex-wrap items-end gap-3"
      >
        <label className="text-sm font-medium">
          Pick a date
          <input
            type="date"
            name="date"
            required
            defaultValue={date}
            className="mt-1.5 block min-h-11 rounded-xl border border-line bg-surface px-3 text-foreground"
          />
        </label>
        <button type="submit" className="btn btn-dark min-h-11">
          Show bookings
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-muted">
          You have no bookings on this day.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="card p-5">
              <p className="text-lg font-medium">
                {formatTime(b.startAt)} to {formatTime(b.endAt)}
              </p>
              <p className="mt-1 font-medium">{b.patientName}</p>
              <p className="text-sm text-muted">
                {b.serviceName} at {b.branchName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
