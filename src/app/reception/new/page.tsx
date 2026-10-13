import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getAvailableSlots, getBookingOptions } from "@/db/booking";
import { getOwnBranchName } from "@/db/reception";
import { addBooking } from "../actions";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  formatDate,
  formatTime,
  isColomboDate,
} from "@/lib/format";
import { MAX_DAYS_AHEAD, isDateBookable } from "@/lib/rules";

export const metadata: Metadata = { title: "Add booking" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const ERRORS: Record<string, string> = {
  slot: "Please choose a time from the list.",
  name: "Please enter the patient's name (2 to 80 letters).",
  phone: "Please enter a phone number like 0771234567.",
  source: "Please choose Phone or Walk-in.",
  agreed: "Please tick the box to confirm the patient agrees.",
  taken: "That time was just taken. Please pick another.",
  server: "Something went wrong on our side. Please try again.",
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-neutral-500 bg-white px-3 text-black";
const buttonClass =
  "min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";

export default function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <NewBookingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewBookingContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["receptionist"]);
  const branchId = user.branchId;
  if (!branchId) redirect("/login");

  const p = await searchParams;
  const serviceId = one(p.service);
  const dentistId = one(p.dentist);
  const date = one(p.date);
  const error = one(p.error);

  const [options, branchName] = await Promise.all([
    getBookingOptions(),
    getOwnBranchName(user),
  ]);

  const today = colomboDateString();
  const maxDate = addDaysToColomboDate(today, MAX_DAYS_AHEAD);

  // Only dentists who work at THIS branch (and offer the chosen service).
  const dentistChoices = options.dentists.filter(
    (d) =>
      d.branchIds.includes(branchId) &&
      (!serviceId || d.serviceIds.includes(serviceId))
  );

  const searched = Boolean(serviceId && date);
  const dateOk = isColomboDate(date) && isDateBookable(date);
  const slots =
    searched && dateOk
      ? await getAvailableSlots({
          isoDate: date,
          branchId,
          serviceId,
          dentistId: dentistId || null,
          minNoticeMinutes: 0,
        })
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Add a booking at {branchName}</h1>
      <p className="mt-1 text-sm opacity-80">
        For phone calls and walk-ins. Times start from now.
      </p>
      <a
        href="/reception"
        className="mt-3 inline-flex min-h-11 items-center underline"
      >
        Back to bookings
      </a>

      {error && ERRORS[error] && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500 p-3 text-sm"
        >
          Error: {ERRORS[error]}
        </p>
      )}

      <form method="get" action="/reception/new" className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          Service
          <select
            name="service"
            required
            defaultValue={serviceId}
            className={inputClass}
          >
            <option value="">Choose a service</option>
            {options.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Dentist (optional)
          <select
            name="dentist"
            defaultValue={dentistId}
            className={inputClass}
          >
            <option value="">Any dentist</option>
            {dentistChoices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Date
          <input
            type="date"
            name="date"
            required
            min={today}
            max={maxDate}
            defaultValue={date}
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
          No free times on that day. Please try another date or dentist.
        </p>
      )}

      {slots && slots.length > 0 && (
        <form action={addBooking} className="mt-8 space-y-4">
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="dentist" value={dentistId} />
          <input type="hidden" name="date" value={date} />

          <fieldset>
            <legend className="text-sm font-medium">
              Free times on {formatDate(colomboToDate(date, "12:00"))}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {slots.map((s) => {
                const value = `${s.dentistId}|${s.startAt}`;
                return (
                  <label key={value} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="slot"
                      value={value}
                      required
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 flex-col justify-center rounded-md border border-neutral-500 px-3 py-1 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                      <span className="font-semibold">
                        {formatTime(s.startAt)}
                      </span>
                      <span className="text-xs opacity-80">
                        {s.dentistName}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-sm font-medium">
            Patient name
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="off"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Phone number
            <input
              type="tel"
              name="phone"
              required
              inputMode="tel"
              autoComplete="off"
              placeholder="0771234567"
              className={inputClass}
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">How was it booked?</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-500 px-4 text-sm">
                <input type="radio" name="source" value="phone" required />
                Phone
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-500 px-4 text-sm">
                <input type="radio" name="source" value="walk_in" required />
                Walk-in
              </label>
            </div>
          </fieldset>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="agreed"
              required
              className="mt-1 h-5 w-5"
            />
            <span>
              The patient agrees that Ivora Dental may keep their name and
              phone number to manage this booking.
            </span>
          </label>

          <button type="submit" className={buttonClass}>
            Add this booking
          </button>
        </form>
      )}
    </main>
  );
}
