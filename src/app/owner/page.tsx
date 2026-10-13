import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";
import { getAllBranches, getWeekBookings, type OwnerBooking } from "@/db/owner";
import {
  countOverlappingBookings,
  getAllDentists,
  getWeekBlocks,
  parseBlockInput,
  type BlockInput,
  type WeekBlock,
} from "@/db/owner-blocks";
import { saveBlock, deleteBlock } from "./actions";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboDayOfWeek,
  colomboMinuteOfDay,
  colomboToDate,
  formatDate,
  formatDateTime,
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

// Grid settings. Bookings and blocks outside these hours are clipped to the edge.
const START_MIN = 8 * 60;
const END_MIN = 19 * 60;
const PX_PER_MIN = 1.5;
const GRID_HEIGHT = (END_MIN - START_MIN) * PX_PER_MIN;

const SOURCE_LABEL = {
  online: "Online",
  phone: "Phone",
  walk_in: "Walk-in",
} as const;

const ERRORS: Record<string, string> = {
  target: "Please choose a branch or a dentist.",
  date: "Please pick a valid start and end date.",
  time: "Please enter times like 09:00.",
  order: "The end must be after the start.",
  server: "Something went wrong on our side. Please try again.",
};

const linkButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-500/60 px-4 text-base font-medium hover:bg-neutral-500/20";

const buttonClass =
  "min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-neutral-500 bg-white px-3 text-black";

const summaryButton =
  "flex min-h-11 cursor-pointer items-center rounded-md border border-neutral-500/60 px-4 text-base font-medium hover:bg-neutral-500/20";

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

// Places one day's bookings. Overlapping bookings get separate lanes,
// side by side, like Google Calendar.
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

// Where a block falls on one Colombo day, as top and height in the grid.
// A block that runs past midnight is clipped to that day.
function bandFor(
  block: WeekBlock,
  day: string
): { top: number; height: number } | null {
  const dayStart = colomboToDate(day, "00:00").getTime();
  const dayEnd = colomboToDate(addDaysToColomboDate(day, 1), "00:00").getTime();
  const bs = new Date(block.startAt).getTime();
  const be = new Date(block.endAt).getTime();
  if (be <= dayStart || bs >= dayEnd) return null;

  const s = bs <= dayStart ? 0 : colomboMinuteOfDay(block.startAt);
  const e = be >= dayEnd ? 24 * 60 : colomboMinuteOfDay(block.endAt);
  const cs = Math.min(Math.max(s, START_MIN), END_MIN);
  const ce = Math.min(Math.max(e, START_MIN), END_MIN);
  if (ce <= cs) return null;

  return { top: (cs - START_MIN) * PX_PER_MIN, height: (ce - cs) * PX_PER_MIN };
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

  const [branches, dentists, bookings, blocks] = await Promise.all([
    getAllBranches(user),
    getAllDentists(user),
    getWeekBookings(user, weekStart, branchId || null),
    getWeekBlocks(user, weekStart),
  ]);

  // ---- Block form and preview ----
  const blockFields = {
    target: one(p.target),
    startDate: one(p.startDate),
    startTime: one(p.startTime),
    endDate: one(p.endDate),
    endTime: one(p.endTime),
    wholeDay: one(p.wholeDay),
    reason: one(p.reason),
  };
  const nameOf = new Map<string, string>();
  for (const b of branches) nameOf.set(`branch:${b.id}`, b.name);
  for (const d of dentists) nameOf.set(`dentist:${d.id}`, d.fullName);

  const showPreview = one(p.preview) === "1";
  let preview: {
    input: BlockInput;
    name: string;
    overlaps: number;
  } | null = null;
  let previewError = "";
  if (showPreview) {
    const parsed = parseBlockInput(blockFields);
    if (!parsed.ok) {
      previewError = ERRORS[parsed.error];
    } else {
      const overlaps = await countOverlappingBookings(
        user,
        parsed.value.target,
        parsed.value.startAt,
        parsed.value.endAt
      );
      preview = {
        input: parsed.value,
        name:
          nameOf.get(`${parsed.value.target.kind}:${parsed.value.target.id}`) ??
          "",
        overlaps,
      };
    }
  }

  const blockedFlag = one(p.blocked) === "1";
  const removedFlag = one(p.removed) === "1";
  const error = one(p.error);

  // ---- Grid ----
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
      <a href="/owner/sms" className="mt-2 inline-flex min-h-11 items-center underline">
        View SMS log (simulated)
      </a>
      <a href="/owner/staff" className="mt-2 ml-4 inline-flex min-h-11 items-center underline">
        Staff logins
      </a>
      <a href="/owner/setup" className="mt-2 ml-4 inline-flex min-h-11 items-center underline">
        Setup: dentists, services, hours
      </a>
      <p className="mt-1 text-sm opacity-80">
        Week of {formatDate(colomboToDate(weekStart, "12:00"))} to{" "}
        {formatDate(colomboToDate(weekEnd, "12:00"))}: {active.length} booked
        {cancelledCount > 0 ? `, ${cancelledCount} cancelled (not shown)` : ""}
      </p>

      {blockedFlag && (
        <p role="status" className="mt-4 rounded-md border border-green-600 p-3 text-sm">
          Block saved. New bookings are stopped for that time.
        </p>
      )}
      {removedFlag && (
        <p role="status" className="mt-4 rounded-md border border-green-600 p-3 text-sm">
          Block removed.
        </p>
      )}
      {error && ERRORS[error] && (
        <p role="alert" className="mt-4 rounded-md border border-red-500 p-3 text-sm">
          Error: {ERRORS[error]}
        </p>
      )}

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
              const dayBlocks = blocks
                .map((b) => ({ block: b, band: bandFor(b, day) }))
                .filter((x) => x.band !== null);
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

                  {/* Blocks: striped, behind the bookings */}
                  {dayBlocks.map(({ block, band }) => (
                    <div
                      key={block.id}
                      title={`Blocked: ${block.targetName}${block.reason ? ` (${block.reason})` : ""}`}
                      className="absolute left-0 right-0 overflow-hidden border border-neutral-500/50 px-1 py-0.5 text-xs leading-tight"
                      style={{
                        top: band!.top,
                        height: band!.height,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgba(120,120,120,0.22) 0 6px, transparent 6px 12px)",
                      }}
                    >
                      <p className="truncate font-semibold">Blocked</p>
                      {band!.height >= 36 && (
                        <p className="truncate opacity-80">{block.targetName}</p>
                      )}
                    </div>
                  ))}

                  {placed.map((pl) => (
                    <div
                      key={pl.booking.id}
                      title={`${formatTime(pl.booking.startAt)} to ${formatTime(
                        pl.booking.endAt
                      )}\n${pl.booking.patientName} ${pl.booking.patientPhone}\n${pl.booking.serviceName} with ${pl.booking.dentistName}\n${pl.booking.branchName}`}
                      className="absolute overflow-hidden rounded border border-primary/60 bg-primary/10 px-1 py-0.5 text-xs leading-tight"
                      style={{
                        top: pl.top,
                        height: pl.height,
                        left: `${(pl.lane * 100) / pl.lanes}%`,
                        width: `calc(${100 / pl.lanes}% - 3px)`,
                      }}
                    >
                      <p className="font-semibold">
                        {formatTime(pl.booking.startAt)}
                      </p>
                      <p className="truncate">{pl.booking.patientName}</p>
                      {pl.height >= 45 && (
                        <p className="truncate opacity-80">
                          {pl.booking.serviceName}
                        </p>
                      )}
                      {pl.height >= 60 && (
                        <p className="truncate opacity-80">
                          {pl.booking.dentistName}
                        </p>
                      )}
                      {!branchId && pl.height >= 75 && (
                        <p className="truncate opacity-80">
                          {pl.booking.branchName}
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

      {/* ---- O3: add a block ---- */}
      <section className="mt-10 rounded-md border border-neutral-500/60 p-4">
        <h2 className="text-lg font-semibold">Block a branch or a dentist</h2>
        <p className="mt-1 text-sm opacity-80">
          Blocks stop new bookings in that time. They do not cancel existing
          bookings.
        </p>

        <form method="get" action="/owner" className="mt-4 space-y-4">
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="branch" value={branchId} />
          <input type="hidden" name="preview" value="1" />

          <label className="block text-sm font-medium">
            Branch or dentist
            <select
              name="target"
              required
              defaultValue={blockFields.target}
              className={inputClass}
            >
              <option value="">Choose one</option>
              <optgroup label="Branches">
                {branches.map((b) => (
                  <option key={b.id} value={`branch:${b.id}`}>
                    Branch: {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Dentists">
                {dentists.map((d) => (
                  <option key={d.id} value={`dentist:${d.id}`}>
                    Dentist: {d.fullName}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Start date
              <input
                type="date"
                name="startDate"
                required
                defaultValue={blockFields.startDate || weekStart}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              Start time
              <input
                type="time"
                name="startTime"
                defaultValue={blockFields.startTime || "09:00"}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              End date
              <input
                type="date"
                name="endDate"
                defaultValue={blockFields.endDate || blockFields.startDate || weekStart}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              End time
              <input
                type="time"
                name="endTime"
                defaultValue={blockFields.endTime || "17:00"}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="wholeDay"
              value="1"
              defaultChecked={blockFields.wholeDay === "1"}
              className="mt-1 h-5 w-5"
            />
            <span>Whole day (ignores the times above; uses the start date only)</span>
          </label>

          <label className="block text-sm font-medium">
            Reason (optional)
            <input
              type="text"
              name="reason"
              maxLength={120}
              defaultValue={blockFields.reason}
              placeholder="Public holiday, leave, training"
              className={inputClass}
            />
          </label>

          <button type="submit" className={buttonClass}>
            Check block
          </button>
        </form>

        {showPreview && previewError && (
          <p role="alert" className="mt-4 rounded-md border border-red-500 p-3 text-sm">
            Error: {previewError}
          </p>
        )}

        {preview && (
          <div className="mt-4 rounded-md border border-neutral-500/60 p-4">
            <p className="text-sm opacity-80">Check before saving</p>
            <p className="mt-1 font-semibold">{preview.name}</p>
            <p className="text-sm">
              {formatDateTime(preview.input.startAt)} to{" "}
              {formatDateTime(preview.input.endAt)}
            </p>
            {preview.input.reason && (
              <p className="text-sm opacity-80">Reason: {preview.input.reason}</p>
            )}
            <p className="mt-3 text-sm font-medium">
              {preview.overlaps === 0
                ? "No booked appointments overlap this block."
                : `This block overlaps ${preview.overlaps} booked ${
                    preview.overlaps === 1 ? "appointment" : "appointments"
                  }. They will NOT be cancelled automatically. Cancel them on the reception screen if needed.`}
            </p>

            <form action={saveBlock} className="mt-4 flex flex-wrap gap-3">
              <input type="hidden" name="week" value={weekStart} />
              <input type="hidden" name="branch" value={branchId} />
              <input type="hidden" name="target" value={blockFields.target} />
              <input type="hidden" name="startDate" value={blockFields.startDate} />
              <input type="hidden" name="startTime" value={blockFields.startTime} />
              <input type="hidden" name="endDate" value={blockFields.endDate} />
              <input type="hidden" name="endTime" value={blockFields.endTime} />
              {blockFields.wholeDay === "1" && (
                <input type="hidden" name="wholeDay" value="1" />
              )}
              <input type="hidden" name="reason" value={blockFields.reason} />
              <button type="submit" className={buttonClass}>
                Save block
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ---- Blocks in this week ---- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Blocks this week</h2>
        {blocks.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No blocks this week.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {blocks.map((b) => (
              <li key={b.id} className="rounded-md border border-neutral-500/60 p-4">
                <p className="font-semibold">
                  {b.kind === "branch" ? "Branch" : "Dentist"}: {b.targetName}
                </p>
                <p className="text-sm">
                  {formatDateTime(b.startAt)} to {formatDateTime(b.endAt)}
                </p>
                {b.reason && <p className="text-sm opacity-80">{b.reason}</p>}

                <details className="mt-2">
                  <summary className={summaryButton}>Remove block</summary>
                  <form action={deleteBlock} className="mt-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="week" value={weekStart} />
                    <input type="hidden" name="branch" value={branchId} />
                    <p className="mb-2 text-sm">
                      Remove this block? The time becomes bookable again.
                    </p>
                    <button
                      type="submit"
                      className="min-h-11 rounded-md bg-red-700 px-4 font-semibold text-white"
                    >
                      Yes, remove this block
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <ComingSoon
          title="Still to build"
          items={[
            "Create and remove staff logins from the browser (for a real client, see README)",
          ]}
        />
      </div>
    </main>
  );
}
