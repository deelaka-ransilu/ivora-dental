import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";
import { getAllBranches, getWeekBookings, type OwnerBooking } from "@/db/owner";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboDayOfWeek,
  colomboMinuteOfDay,
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

// Grid settings. Bookings outside these hours are clipped to the edge.
const START_MIN = 8 * 60;
const END_MIN = 19 * 60;
const PX_PER_MIN = 1.5;
const GRID_HEIGHT = (END_MIN - START_MIN) * PX_PER_MIN;

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

type Placed = {
  booking: OwnerBooking;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

// Places one day's bookings. Overlapping bookings get separate lanes
// (side by side), like Google Calendar.
function placeDay(items: OwnerBooking[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const laneEnds: number[] = [];
  const rows: { booking: OwnerBooking; s: number; e: number; lane: number }[] =
    [];

  for (const b of sorted) {
    const s = colomboMinuteOfDay(b.startAt);
    const e = Math.max(colomboMinuteOfDay(b.endAt), s + 15);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    rows.push({ booking: b, s, e, lane });
  }

  const lanes = Math.max(1, laneEnds.length);
  return rows.map((r) => {
    const s = Math.min(Math.max(r.s, START_MIN), END_MIN);
    const e = Math.min(Math.max(r.e, START_MIN), END_MIN);
    return {
      booking: r.booking,
      top: (s - START_MIN) * PX_PER_MIN,
      height: Math.max((e - s) * PX_PER_MIN, 24),
      lane: r.lane,
      lanes,
    };
  });
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
  const hours = Array.from(
    { length: (END_MIN - START_MIN) / 60 },
    (_, i) => START_MIN / 60 + i
  );

  const branchQuery = branchId ? `&branch=${branchId}` : "";
  const thisWeekHref = branchId ? `/owner?branch=${branchId}` : "/owner";
  const prevHref = `/owner?week=${addDaysToColomboDate(weekStart, -7)}${branchQuery}`;
  const nextHref = `/owner?week=${addDaysToColomboDate(weekStart, 7)}${branchQuery}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Schedule: {branchName}</h1>
      <p className="mt-1 text-sm opacity-80">
        Week of {formatDate(colomboToDate(weekStart, "12:00"))} to{" "}
        {formatDate(colomboToDate(weekEnd, "12:00"))}: {active.length} booked
        {cancelledCount > 0 ? `, ${cancelledCount} cancelled (not shown)` : ""}
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

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[840px]">
          {/* Day headings */}
          <div className="flex border-b border-neutral-500/60">
            <div className="w-14 shrink-0" />
            {days.map((day) => {
              const count = active.filter(
                (b) => colomboDateString(b.startAt) === day
              ).length;
              return (
                <div
                  key={day}
                  className="flex-1 border-l border-neutral-500/40 px-2 pb-2 text-center"
                >
                  <p className="text-sm font-semibold">
                    {formatDate(colomboToDate(day, "12:00"))}
                  </p>
                  <p className="text-xs opacity-70">{count} booked</p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex">
            <div className="relative w-14 shrink-0" style={{ height: GRID_HEIGHT }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-xs opacity-70"
                  style={{ top: (h * 60 - START_MIN) * PX_PER_MIN }}
                >
                  {formatTime(colomboToDate(days[0], `${String(h).padStart(2, "0")}:00`))}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayBookings = active.filter(
                (b) => colomboDateString(b.startAt) === day
              );
              const placed = placeDay(dayBookings);
              return (
                <div
                  key={day}
                  className="relative flex-1 border-l border-neutral-500/40"
                  style={{ height: GRID_HEIGHT }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-neutral-500/20"
                      style={{ top: (h * 60 - START_MIN) * PX_PER_MIN }}
                    />
                  ))}

                  {placed.map((p) => (
                    <div
                      key={p.booking.id}
                      title={`${formatTime(p.booking.startAt)} to ${formatTime(
                        p.booking.endAt
                      )}\n${p.booking.patientName} ${p.booking.patientPhone}\n${p.booking.serviceName} with ${p.booking.dentistName}\n${p.booking.branchName}`}
                      className="absolute overflow-hidden rounded border border-primary/60 bg-primary/10 px-1 py-0.5 text-xs leading-tight"
                      style={{
                        top: p.top,
                        height: p.height,
                        left: `${(p.lane * 100) / p.lanes}%`,
                        width: `calc(${100 / p.lanes}% - 3px)`,
                      }}
                    >
                      <p className="font-semibold">
                        {formatTime(p.booking.startAt)}
                      </p>
                      <p className="truncate">{p.booking.patientName}</p>
                      {p.height >= 45 && (
                        <p className="truncate opacity-80">
                          {p.booking.serviceName}
                        </p>
                      )}
                      {p.height >= 60 && (
                        <p className="truncate opacity-80">
                          {p.booking.dentistName}
                        </p>
                      )}
                      {!branchId && p.height >= 75 && (
                        <p className="truncate opacity-80">
                          {p.booking.branchName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
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
