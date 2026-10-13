import { Suspense } from "react";
import type { Metadata } from "next";
import { bookAppointment } from "./actions";
import { getAvailableSlots, getBookingOptions } from "@/db/booking";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  formatDate,
  formatDateTime,
  formatTime,
  isColomboDate,
} from "@/lib/format";
import { MAX_DAYS_AHEAD, isDateBookable } from "@/lib/rules";

export const metadata: Metadata = { title: "Book an appointment" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const ERRORS: Record<string, string> = {
  slot: "Please choose a time from the list.",
  name: "Please enter your name (2 to 80 letters).",
  phone: "Please enter a phone number like 0771234567.",
  consent: "Please tick the box so we can save your booking.",
  taken: "That time was just taken. Please pick another.",
  server: "Something went wrong on our side. Please try again.",
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-neutral-500 bg-white px-3 text-black";
const buttonClass =
  "min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";

export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">Book an appointment</h1>
      <p className="mt-2 text-sm opacity-80">
        Choose a branch and a service, then pick a free time. You only need
        your name and phone number.
      </p>
      <Suspense fallback={<p className="mt-6">Loading...</p>}>
        <BookingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BookingContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const p = await searchParams;
  const options = await getBookingOptions();

  const branchId = one(p.branch);
  const serviceId = one(p.service);
  const dentistId = one(p.dentist);
  const date = one(p.date);
  const error = one(p.error);

  // ---- Confirmation screen ----
  if (one(p.confirmed) === "1") {
    const start = one(p.start);
    const branch = options.branches.find((b) => b.id === branchId);
    const service = options.services.find((s) => s.id === serviceId);
    const dentist = options.dentists.find((d) => d.id === dentistId);
    const validStart = !Number.isNaN(new Date(start).getTime());
    return (
      <div className="mt-6 rounded-md border border-neutral-500 p-4">
        <h2 className="text-lg font-semibold">Your appointment is booked</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div>
            <dt className="inline opacity-80">When: </dt>
            <dd className="inline font-medium">
              {validStart ? formatDateTime(start) : "-"}
            </dd>
          </div>
          <div>
            <dt className="inline opacity-80">Where: </dt>
            <dd className="inline font-medium">
              Ivora {branch?.name ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="inline opacity-80">Service: </dt>
            <dd className="inline font-medium">{service?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="inline opacity-80">Dentist: </dt>
            <dd className="inline font-medium">
              {dentist?.fullName ?? "-"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm opacity-80">
          A confirmation message was saved to the SMS log (simulated, nothing
          is really sent in this demo).
        </p>
        <a
          href="/book"
          className="mt-4 flex min-h-11 items-center justify-center rounded-md border border-neutral-500 px-4 font-semibold"
        >
          Book another appointment
        </a>
      </div>
    );
  }

  // ---- Search form and free times ----
  const today = colomboDateString();
  const maxDate = addDaysToColomboDate(today, MAX_DAYS_AHEAD);

  const dentistChoices = options.dentists.filter(
    (d) =>
      (!serviceId || d.serviceIds.includes(serviceId)) &&
      (!branchId || d.branchIds.includes(branchId))
  );

  const searched = Boolean(branchId && serviceId && date);
  const dateOk = isColomboDate(date) && isDateBookable(date);
  const slots =
    searched && dateOk
      ? await getAvailableSlots({
          isoDate: date,
          branchId,
          serviceId,
          dentistId: dentistId || null,
        })
      : null;

  return (
    <>
      {error && ERRORS[error] && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-500 p-3 text-sm"
        >
          Error: {ERRORS[error]}
        </p>
      )}

      <form method="get" action="/book" className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Branch
          <select
            name="branch"
            required
            defaultValue={branchId}
            className={inputClass}
          >
            <option value="">Choose a branch</option>
            {options.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

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
          Please pick a date from today up to {formatDate(colomboToDate(maxDate, "12:00"))}.
        </p>
      )}

      {slots && slots.length === 0 && (
        <p className="mt-6 text-sm">
          No free times on that day. Please try another date, branch or
          dentist.
        </p>
      )}

      {slots && slots.length > 0 && (
        <form action={bookAppointment} className="mt-8 space-y-4">
          <input type="hidden" name="branch" value={branchId} />
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
            Your name
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
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
              autoComplete="tel"
              placeholder="0771234567"
              className={inputClass}
            />
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-1 h-5 w-5"
            />
            <span>
              I agree that Ivora Dental may keep my name and phone number to
              manage this booking.
            </span>
          </label>

          <button type="submit" className={buttonClass}>
            Book this time
          </button>
        </form>
      )}
    </>
  );
}
