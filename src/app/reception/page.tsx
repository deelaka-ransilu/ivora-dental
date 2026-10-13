import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getBranchBookings, getOwnBranchName } from "@/db/reception";
import { cancelBooking, deletePatientData } from "./actions";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  formatDate,
  formatTime,
  isColomboDate,
} from "@/lib/format";

export const metadata: Metadata = { title: "Reception" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const SOURCE_LABEL = {
  online: "Online",
  phone: "Phone",
  walk_in: "Walk-in",
} as const;

const ERRORS: Record<string, string> = {
  notfound: "That booking could not be found at this branch.",
  other_branch:
    "This patient also has bookings at another branch, so their data cannot be deleted here.",
  server: "Something went wrong on our side. Please try again.",
};

const linkButton =
  "btn btn-light min-h-11";

const summaryButton =
  "btn btn-light min-h-11 cursor-pointer";

export default function ReceptionPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <ReceptionContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReceptionContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["receptionist"]);

  const p = await searchParams;
  const raw = one(p.date);
  const added = one(p.added) === "1";
  const moved = one(p.moved) === "1";
  const deleted = one(p.deleted) === "1";
  const error = one(p.error);
  const today = colomboDateString();
  const date = isColomboDate(raw) ? raw : today;

  const [branchName, bookings] = await Promise.all([
    getOwnBranchName(user),
    getBranchBookings(user, date),
  ]);

  const active = bookings.filter((b) => b.status === "booked");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-8 text-3xl font-medium tracking-tight">Bookings at {branchName}</h1>
      <p className="mt-1 text-sm opacity-80">
        {formatDate(colomboToDate(date, "12:00"))}: {active.length} booked
        {bookings.length > active.length
          ? `, ${bookings.length - active.length} cancelled`
          : ""}
      </p>

      {added && (
        <p
          role="status"
          className="mt-4 rounded-card border border-green-300 bg-green-50 p-4 text-sm text-green-900"
        >
          Booking added.
        </p>
      )}
      {moved && (
        <p
          role="status"
          className="mt-4 rounded-card border border-green-300 bg-green-50 p-4 text-sm text-green-900"
        >
          Booking moved.
        </p>
      )}
      {deleted && (
        <p
          role="status"
          className="mt-4 rounded-card border border-green-300 bg-green-50 p-4 text-sm text-green-900"
        >
          Patient data deleted.
        </p>
      )}
      {error && ERRORS[error] && (
        <p
          role="alert"
          className="mt-4 rounded-card border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          Error: {ERRORS[error]}
        </p>
      )}

      <a
        href="/reception/new"
        className="btn btn-dark mt-4 min-h-11 w-full"
      >
        Add a booking (phone or walk-in)
      </a>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <a
          href={`/reception?date=${addDaysToColomboDate(date, -1)}`}
          className={linkButton}
        >
          Previous day
        </a>
        <a href="/reception" className={linkButton}>
          Today
        </a>
        <a
          href={`/reception?date=${addDaysToColomboDate(date, 1)}`}
          className={linkButton}
        >
          Next day
        </a>
      </div>

      <form method="get" action="/reception" className="mt-3 flex flex-wrap items-end gap-3">
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
        <button
          type="submit"
          className="btn btn-dark min-h-11"
        >
          Show bookings
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="mt-6 text-sm">No bookings at this branch on this day.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-semibold">
                  {formatTime(b.startAt)} to {formatTime(b.endAt)}
                </p>
                <p className="chip text-sm font-medium">
                  {b.status === "booked" ? "Booked" : "Cancelled"}
                </p>
              </div>
              <p className="mt-1 font-medium">{b.patientName}</p>
              <p className="mt-1">
                <a
                  href={`tel:${b.patientPhone}`}
                  className="inline-flex min-h-11 items-center underline"
                >
                  {b.patientPhone}
                </a>
              </p>
              <p className="text-sm opacity-80">
                {b.serviceName} with {b.dentistName} ({SOURCE_LABEL[b.source]})
              </p>

              {b.status === "booked" && (
                <div className="mt-3 space-y-2">
                  <a href={`/reception/move?id=${b.id}`} className={linkButton}>
                    Move booking
                  </a>

                  <details>
                    <summary className={summaryButton}>Cancel booking</summary>
                    <form action={cancelBooking} className="mt-2">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="date" value={date} />
                      <p className="mb-2 text-sm">
                        Cancel the booking for {b.patientName} at{" "}
                        {formatTime(b.startAt)}? The time becomes free again.
                      </p>
                      <button
                        type="submit"
                        className="btn min-h-11 bg-red-700 text-white hover:bg-red-800"
                      >
                        Yes, cancel this booking
                      </button>
                    </form>
                  </details>
                </div>
              )}

              <details className="mt-2">
                <summary className={summaryButton}>Delete patient data</summary>
                <form action={deletePatientData} className="mt-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="date" value={date} />
                  <p className="mb-2 text-sm">
                    Delete {b.patientName}&apos;s name and phone number, and all
                    of their bookings? This cannot be undone.
                  </p>
                  <button
                    type="submit"
                    className="btn min-h-11 bg-red-700 text-white hover:bg-red-800"
                  >
                    Yes, delete this patient&apos;s data
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
