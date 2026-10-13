import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getSetupData } from "@/db/owner-setup";
import { saveDentist, saveHours, saveService } from "./actions";

export const metadata: Metadata = { title: "Setup" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-neutral-500 bg-white px-3 text-black";
const buttonClass =
  "min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";
const linkButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-500/60 px-4 text-base font-medium hover:bg-neutral-500/20";

function errorText(code: string, n: string): string {
  switch (code) {
    case "name":
      return "Please enter a name (2 to 80 letters).";
    case "duration":
      return "Duration must be between 5 and 240 minutes, in steps of 5.";
    case "time":
      return "Please enter times like 09:00.";
    case "order":
      return "The end time must be after the start time.";
    case "confirm":
      return `This change affects ${n} future ${n === "1" ? "booking" : "bookings"}. They stay as they are. Tick the confirm box and save again.`;
    default:
      return "Something went wrong on our side. Please try again.";
  }
}

// The page is not async. Cookies and searchParams are read in the child
// component, behind Suspense, as Cache Components requires.
export default function SetupPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <SetupContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SetupContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["owner"]);
  const p = await searchParams;
  const saved = one(p.saved) === "1";
  const error = one(p.error);
  const n = one(p.n);

  const data = await getSetupData(user);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Setup</h1>
      <p className="mt-1 text-sm opacity-80">
        Edit only. Nothing is deleted. Changes apply to new bookings.
      </p>
      <a href="/owner" className="mt-3 inline-flex min-h-11 items-center underline">
        Back to schedule
      </a>

      {saved && (
        <p role="status" className="mt-4 rounded-md border border-green-600 p-3 text-sm">
          Saved.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-red-500 p-3 text-sm">
          Error: {errorText(error, n)}
        </p>
      )}

      {/* ---- Dentists ---- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Dentists</h2>
        <p className="mt-1 text-sm opacity-80">
          Switching a dentist off hides them from the booking form. Their
          existing bookings stay.
        </p>
        <ul className="mt-3 space-y-4">
          {data.dentists.map((d) => (
            <li key={d.id} className="rounded-md border border-neutral-500/60 p-4">
              <form action={saveDentist} className="space-y-3">
                <input type="hidden" name="id" value={d.id} />
                <label className="block text-sm font-medium">
                  Name
                  <input type="text" name="fullName" required minLength={2} maxLength={80} defaultValue={d.fullName} className={inputClass} />
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={d.isActive} className="h-5 w-5" />
                  Active (shown in the booking form)
                </label>
                <p className="text-sm opacity-80">
                  Future bookings: {d.futureBookings}
                </p>
                {d.futureBookings > 0 && (
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="confirm" className="mt-1 h-5 w-5" />
                    <span>If switching off, I understand the {d.futureBookings} future bookings stay as they are.</span>
                  </label>
                )}
                <button type="submit" className={buttonClass}>Save dentist</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Services ---- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Services</h2>
        <p className="mt-1 text-sm opacity-80">
          A new duration applies to new bookings only. Existing bookings keep
          their times.
        </p>
        <ul className="mt-3 space-y-4">
          {data.services.map((s) => (
            <li key={s.id} className="rounded-md border border-neutral-500/60 p-4">
              <form action={saveService} className="space-y-3">
                <input type="hidden" name="id" value={s.id} />
                <label className="block text-sm font-medium">
                  Name
                  <input type="text" name="name" required minLength={2} maxLength={80} defaultValue={s.name} className={inputClass} />
                </label>
                <label className="block text-sm font-medium">
                  Duration (minutes, steps of 5)
                  <input type="number" name="duration" required min={5} max={240} step={5} defaultValue={s.durationMinutes} className={inputClass} />
                </label>
                <button type="submit" className={buttonClass}>Save service</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Opening hours ---- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <p className="mt-1 text-sm opacity-80">
          New hours apply to new bookings. If a future booking falls outside
          them, it stays, and you must tick the confirm box to save.
        </p>
        <ul className="mt-3 space-y-4">
          {data.hours.map((h) => (
            <li key={h.id} className="rounded-md border border-neutral-500/60 p-4">
              <p className="font-semibold">
                {h.dentistName} · {h.branchName}
              </p>
              <p className="text-sm opacity-80">{DAY_NAMES[h.dayOfWeek]}</p>
              <form action={saveHours} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={h.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Start
                    <input type="time" name="startTime" required defaultValue={h.startTime} className={inputClass} />
                  </label>
                  <label className="block text-sm font-medium">
                    End
                    <input type="time" name="endTime" required defaultValue={h.endTime} className={inputClass} />
                  </label>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="confirm" className="mt-1 h-5 w-5" />
                  <span>Save even if future bookings fall outside these hours.</span>
                </label>
                <button type="submit" className={buttonClass}>Save hours</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
