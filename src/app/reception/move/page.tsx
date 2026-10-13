import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getAvailableSlots } from "@/db/booking";
import { getOwnBranchBooking } from "@/db/reception";
import { moveBooking } from "../actions";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  formatDate,
  formatTime,
  isColomboDate,
} from "@/lib/format";
import { MAX_DAYS_AHEAD, isDateBookable } from "@/lib/rules";

export const metadata: Metadata = { title: "Move booking" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const ERRORS: Record<string, string> = {
  slot: "Please choose a time from the list.",
  taken: "That time was just taken. Please pick another.",
  server: "Something went wrong on our side. Please try again.",
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-neutral-500 bg-white px-3 text-black";
const buttonClass =
  "min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";

export default function MoveBookingPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <MoveBookingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MoveBookingContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["receptionist"]);
  const branchId = user.branchId;
  if (!branchId) redirect("/login");

  const p = await searchParams;
  const id = one(p.id);
  const date = one(p.date);
  const error = one(p.error);

  // Only a booked appointment at the user's OWN branch can be moved.
  const booking = await getOwnBranchBooking(user, id);
  if (!booking || booking.status !== "booked") {
    redirect("/reception?error=notfound");
  }

  const today = colomboDateString();
  const maxDate = addDaysToColomboDate(today, MAX_DAYS_AHEAD);
  const currentDate = colomboDateString(booking.startAt);

  const searched = Boolean(date);
  const dateOk = isColomboDate(date) && isDateBookable(date);
  const slots =
    searched && dateOk
      ? await getAvailableSlots({
          isoDate: date,
          branchId,
          serviceId: booking.serviceId,
          dentistId: booking.dentistId,
          minNoticeMinutes: 0,
        })
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Move a booking</h1>
      <a
        href={`/reception?date=${currentDate}`}
        className="mt-3 inline-flex min-h-11 items-center underline"
      >
        Back to bookings
      </a>

      <div className="mt-4 rounded-md border border-neutral-500/60 p-4">
        <p className="text-sm opacity-80">Current booking</p>
        <p className="mt-1 text-lg font-semibold">
          {formatDate(booking.startAt)}, {formatTime(booking.startAt)} to{" "}
          {formatTime(booking.endAt)}
        </p>
        <p className="mt-1 font-medium">{booking.patientName}</p>
        <p className="text-sm opacity-80">
          {booking.serviceName} with {booking.dentistName}
        </p>
        <p className="mt-2 text-sm opacity-80">
          Same dentist and service. Pick a new date and time.
        </p>
      </div>

      {error && ERRORS[error] && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500 p-3 text-sm"
        >
          Error: {ERRORS[error]}
        </p>
      )}

      <form method="get" action="/reception/move" className="mt-4 space-y-4">
        <input type="hidden" name="id" value={id} />
        <label className="block text-sm font-medium">
          New date
          <input
            type="date"
            name="date"
            required
            min={today}
            max={maxDate}
            defaultValue={date || currentDate}
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          Show free times
        </button>
      </form>

      {searched && !dateOk && (
        <p className="mt-6 text-sm">
          Please pick a date from today up to{" "}
          {formatDate(colomboToDate(maxDate, "12:00"))}.
        </p>
      )}

      {slots && slots.length === 0 && (
        <p className="mt-6 text-sm">
          No free times for {booking.dentistName} on that day. Please try
          another date.
        </p>
      )}

      {slots && slots.length > 0 && (
        <form action={moveBooking} className="mt-8 space-y-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="date" value={date} />

          <fieldset>
            <legend className="text-sm font-medium">
              Free times on {formatDate(colomboToDate(date, "12:00"))}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {slots.map((s) => (
                <label key={s.startAt} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="slot"
                    value={s.startAt}
                    required
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-md border border-neutral-500 px-3 py-1 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                    {formatTime(s.startAt)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className={buttonClass}>
            Move this booking
          </button>
        </form>
      )}
    </main>
  );
}
