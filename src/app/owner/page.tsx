import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";
import { getAllBranches, getWeekBookings } from "@/db/owner";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboDayOfWeek,
  colomboToDate,
  formatDate,
  formatTime,
  isColomboDate,
} from "@/lib/format";

export const metadata: Metadata = { title: "Owner" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_LABEL = {
  online: "Online",
  phone: "Phone",
  walk_in: "Walk-in",
} as const;

const linkButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-500/60 px-4 text-base font-medium hover:bg-neutral-500/20";

const buttonClass =
  "min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";

// Monday of the week that contains this Colombo date.
function weekStartOf(isoDate: string): string {
  const dow = colomboDayOfWeek(isoDate); // 0 = Sunday ... 6 = Saturday
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysToColomboDate(isoDate, offset);
}

// The page is not async. Cookies and searchParams are read in the child
// component, behind Suspense, as Cache Components requires.
export default function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <OwnerContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OwnerContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["owner"]);

  const p = await searchParams;
  const rawWeek = one(p.week);
  const today = colomboDateString();
  const weekStart = weekStartOf(isColomboDate(rawWeek) ? rawWeek : today);
  const weekEnd = addDaysToColomboDate(weekStart, 6);

  const rawBranch = one(p.branch);
  const branchId = UUID.test(rawBranch) ? rawBranch : "";

  const [branches, bookings] = await Promise.all([
    getAllBranches(user),
    getWeekBookings(user, weekStart, branchId || null),
  ]);

  const branchName =
    branches.find((b) => b.id === branchId)?.name ?? "All branches";
  const active = bookings.filter((b) => b.status === "booked");
  const cancelledCount = bookings.length - active.length;

  const days = Array.from({ length: 7 }, (_, i) =>
    addDaysToColomboDate(weekStart, i)
  );

  const branchQuery = branchId ? `&branch=${branchId}` : "";
  const thisWeekHref = branchId ? `/owner?branch=${branchId}` : "/owner";
  const prevHref = `/owner?week=${addDaysToColomboDate(weekStart, -7)}${branchQuery}`;
  const nextHref = `/owner?week=${addDaysToColomboDate(weekStart, 7)}${branchQuery}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Schedule: {branchName}</h1>
      <p className="mt-1 text-sm opacity-80">
        Week of {formatDate(colomboToDate(weekStart, "12:00"))} to{" "}
        {formatDate(colomboToDate(weekEnd, "12:00"))}: {active.length} booked
        {cancelledCount > 0 ? `, ${cancelledCount} cancelled` : ""}
      </p>
      <p className="mt-1 text-sm opacity-80">Read-only for now.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <a href={prevHref} className={linkButton}>
          Previous week
        </a>
        <a href={thisWeekHref} className={linkButton}>
          This week
        </a>
        <a href={nextHref} className={linkButton}>
          Next week
        </a>
      </div>

      <form
        method="get"
        action="/owner"
        className="mt-3 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="week" value={weekStart} />
        <label className="text-sm font-medium">
          Branch
          <select
            name="branch"
            defaultValue={branchId}
            className="mt-1 block min-h-11 rounded-md border border-neutral-500 bg-white px-3 text-black"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass}>
          Show
        </button>
      </form>

      <div className="mt-6 space-y-6">
        {days.map((day) => {
          const dayBookings = active.filter(
            (b) => colomboDateString(b.startAt) === day
          );
          return (
            <section key={day}>
              <h2 className="text-base font-semibold">
                {formatDate(colomboToDate(day, "12:00"))}
                <span className="ml-2 text-sm font-normal opacity-80">
                  ({dayBookings.length} booked)
                </span>
              </h2>

              {dayBookings.length === 0 ? (
                <p className="mt-2 text-sm opacity-80">No bookings.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {dayBookings.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-md border border-neutral-500/60 p-3"
                    >
                      <p className="font-semibold">
                        {formatTime(b.startAt)} to {formatTime(b.endAt)}
                        {!branchId && (
                          <span className="ml-2 text-sm font-normal opacity-80">
                            {b.branchName}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm">
                        {b.patientName} ·{" "}
                        <a
                          href={`tel:${b.patientPhone}`}
                          className="underline"
                        >
                          {b.patientPhone}
                        </a>
                      </p>
                      <p className="text-sm opacity-80">
                        {b.serviceName} with {b.dentistName} (
                        {SOURCE_LABEL[b.source]})
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-8">
        <ComingSoon
          title="Still to build"
          items={[
            "Block a branch or a dentist for a day (O3)",
            "SMS log, labelled simulated",
            "Set up branches, dentists, services and opening hours (O2)",
            "Create and remove staff logins (O4)",
          ]}
        />
      </div>
    </main>
  );
}
