import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
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
  "mt-1.5 block min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-foreground";
const labelClass = "block text-sm font-medium";

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {step}
      </span>
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  );
}

export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-medium tracking-tight sm:text-4xl">
        Book an appointment
      </h1>
      <p className="mt-2 max-w-md text-base text-muted">
        Choose a branch and a service, then pick a free time. You only need
        your name and phone number.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading...</p>}>
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
      <div className="mt-8 rounded-card bg-tint-sage p-6 sm:p-8">
        <h2 className="text-2xl font-medium">Your appointment is booked</h2>
        <dl className="mt-5 space-y-3 text-base">
          <div>
            <dt className="text-sm text-muted">When</dt>
            <dd className="font-medium">
              {validStart ? formatDateTime(start) : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Where</dt>
            <dd className="font-medium">Ivora {branch?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Service</dt>
            <dd className="font-medium">{service?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Dentist</dt>
            <dd className="font-medium">{dentist?.fullName ?? "-"}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-muted">
          A confirmation message was saved to the SMS log (simulated, nothing
          is really sent in this demo).
        </p>
        <a href="/book" className="btn btn-dark mt-6 min-h-12 w-full sm:w-auto">
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
          className="mt-6 rounded-card border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          Error: {ERRORS[error]}
        </p>
      )}

      <form method="get" action="/book" className="card mt-6 p-6 sm:p-8">
        <StepHeading step={1} title="Find a time" />
        <div className="mt-5 space-y-4">
          <label className={labelClass}>
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

          <label className={labelClass}>
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

          <label className={labelClass}>
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

          <label className={labelClass}>
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

          <button type="submit" className="btn btn-dark min-h-12 w-full">
            Show free times
          </button>
        </div>
      </form>

      {searched && !dateOk && (
        <p className="mt-6 text-sm text-muted">
          Please pick a date from today up to{" "}
          {formatDate(colomboToDate(maxDate, "12:00"))}.
        </p>
      )}

      {slots && slots.length === 0 && (
        <p className="card mt-6 p-6 text-sm text-muted">
          No free times on that day. Please try another date, branch or
          dentist.
        </p>
      )}

      {slots && slots.length > 0 && (
        <form action={bookAppointment} className="mt-6 space-y-6">
          <input type="hidden" name="branch" value={branchId} />
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="dentist" value={dentistId} />
          <input type="hidden" name="date" value={date} />

          <fieldset className="card p-6 sm:p-8">
            <legend className="sr-only">
              Free times on {formatDate(colomboToDate(date, "12:00"))}
            </legend>
            <StepHeading step={2} title="Pick a time" />
            <p className="mt-2 text-sm text-muted">
              Free times on {formatDate(colomboToDate(date, "12:00"))}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    <span className="flex min-h-14 flex-col justify-center rounded-xl border border-line bg-surface px-4 py-2 transition-colors hover:border-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      <span className="text-base font-medium">
                        {formatTime(s.startAt)}
                      </span>
                      <span className="text-xs opacity-70">
                        {s.dentistName}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="card p-6 sm:p-8">
            <StepHeading step={3} title="Your details" />
            <div className="mt-5 space-y-4">
              <label className={labelClass}>
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

              <label className={labelClass}>
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

              <label className="flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                <span>
                  I agree that Ivora Dental may keep my name and phone number
                  to manage this booking.
                </span>
              </label>

              <button type="submit" className="btn btn-dark min-h-12 w-full">
                Book this time
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
