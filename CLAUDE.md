
## Architecture rules

1. **All database access is on the server** (server components, server actions, route handlers). The secret key is in `SUPABASE_SECRET_KEY`, never prefixed with `NEXT_PUBLIC_`, never imported into a client component.
2. **Every server action and page checks the role first** with `requireRole()` from `lib/auth.ts`. Hiding a button is not security.
3. **Row-level security is enabled on every table with no policies**, and `anon` / `authenticated` have no privileges. The browser-side keys can read and write nothing. The server uses the secret key (`service_role`), which bypasses RLS. We do not write RLS policies in v1. Access control is done in server code.
4. **The double-booking rule lives in the database**, as an exclusion constraint (see "Data model"). Server code also checks first to give a friendly message, but the constraint is the real guard. If the insert fails with an exclusion violation, show "That time was just taken. Please pick another."
5. **Time is stored as `timestamptz` and shown in `Asia/Colombo`** (UTC+5:30, no daylight saving). Do not store local strings. Conversion to and from Colombo time happens only in `lib/format.ts`. Working hours are the exception: they are local `time` columns by design.
6. **Booking rules live in `lib/rules.ts`** (notice period, slot generation, closure checks). Do not re-implement them inside a page.
7. **Roles and branch limits are enforced in `src/db/` query functions**, which take the current user. A receptionist's queries always filter by their own branch. A dentist's queries always filter by their own dentist id. Owner functions refuse anyone who is not the owner.
8. **Dentists never see patient phone numbers.** Their view returns name, time, service and branch only. Do not add phone to that query.
9. **No treatment details anywhere.** Service names are generic. Never add a notes or diagnosis field.
10. **Schema changes only through migrations** (see "Migrations").
11. **Keep demo and app apart.** Demo-only behavior (demo sign-in buttons, demo banner, `seed.ts`, the `@ivora-demo.test` email limit in `owner-staff.ts`) goes in clearly named places so it can be deleted for a real install. Nothing in the core booking code may import from them.
12. **Do not add libraries without asking.** Check the existing dependencies first.
13. **Nothing is deleted from the owner screens.** Dentists and logins are switched off (`is_active`), services and hours are edited. Only reception's "delete patient data" deletes rows (R3).

## Data model (PostgreSQL)

| Table | Purpose |
|---|---|
| `branches` | Name, address, phone, active flag |
| `dentists` | Name, active flag |
| `services` | Generic name, duration in minutes (multiple of 5) |
| `dentist_services` | Which dentist does which service |
| `dentist_branch_hours` | Dentist, branch, weekday (0 = Sunday), start time, end time (this is the "matrix") |
| `profiles` | Links a Supabase Auth user to a role (`owner`, `receptionist`, `dentist`), a branch (receptionists) and a dentist (dentists), plus an active flag |
| `patients` | Name, phone, consent timestamp. Nothing else |
| `appointments` | Patient, branch, dentist, service, `start_at`, `end_at`, status (`booked`, `cancelled`), source (`online`, `phone`, `walk_in`), created by |
| `blocked_times` | Either a branch or a dentist (exactly one), start, end, reason. For holidays and closures |
| `sms_log` | Appointment, destination phone, message text. Simulated sends |

**The key rule (S1)** is the exclusion constraint `appointments_no_dentist_overlap`: same `dentist_id`, overlapping `tstzrange(start_at, end_at)`, only where `status = 'booked'`. It stops one dentist being booked twice at overlapping times, in any branch, even if the app code has a bug. Cancelled appointments are ignored. It needs the `btree_gist` extension, which migration 1 creates.

**Assumption:** one chair per dentist, so a branch cannot run out of chairs before it runs out of dentists. The owner has not confirmed this. If chairs are shared, add a second rule. Not built.

## Functional requirements

Locked. A feature is IN only if it is on this list. Everything else is OUT or LATER.

**Patient**
- P1. View available times by branch, service and optionally dentist.
- P2. Book giving only name and phone.
- P3. Tick a consent checkbox with one sentence before booking.
- P4. Receive an SMS confirmation (English, generic wording). **Simulated** in this build.
- P5. Reach the booking page from a public web address that works on a phone.
- P6. Online bookings need at least 2 hours' notice.

**Receptionist** (own branch only)
- R1. Add, move and cancel bookings (phone and walk-in).
- R2. List bookings filtered by branch and date, for confirmation calls.
- R3. Delete a patient's data on request.

**Dentist** (read-only)
- D1. Log in and see their own bookings across all their branches.
- D2. Cannot add, move or cancel.
- D3. Sees only their own bookings, not other dentists'. Shows name, time, service and branch only (no phone).

**Owner**
- O1. See one schedule across all 3 branches.
- O2. Set up dentists, services and working hours (edit only). **Editing branches is not built**; it is listed in the README as something for a real client.
- O3. Block a branch or a dentist for a day or a time range.
- O4. Create staff logins (receptionist or dentist) and deactivate or reactivate them. Nothing is deleted.

**System rules**
- S1. A dentist cannot be booked in two places at the same time.
- S2. Each service has a fixed duration. No buffer or cleaning time.
- S3. Each person has their own login. Receptionists see only their branch, dentists only their own bookings, only the owner has full access.
- S5. No treatment details stored or sent anywhere.
- S7. Public pages: a simple home page and the booking page, English only.

**Skipped on purpose for the portfolio build** (listed in the README under "What I'd add for a real client"): two-factor login for the owner, real SMS provider, backups beyond what Supabase gives, PDPA review and retention policy, reminders, editing branches from the browser.

**OUT or LATER:** WhatsApp API messages, reminders, payments, mobile app, old-data import, Sinhala/Tamil, patient self-service cancel or reschedule, no-show tracking.

## Demo behavior

- **Sign-in:** the login page has three buttons: **Owner**, **Receptionist (Negombo)** and **Dr. Fernando**. Each signs in as a seeded Supabase Auth user. The accounts only hold fictional data. This is a convenience for visitors, not security. The password is `DEMO_PASSWORD`, used only on the server by the demo login buttons; it is not shown anywhere on the site. There is no Colombo 7 or Nugegoda receptionist button, although those logins exist.
- **Banner:** every page shows "Demo with fictional data. Please don't enter real details." The booking form shows it too.
- **Seed data** (`scripts/seed.ts`), what it creates:
  - 3 branches and 5 dentists. Dr. Anura Fernando works at Negombo (Mon, Wed, Fri 9-17, Sat 9-13) and Colombo 7 (Tue, Thu 9-17). The others are Silva, Jayawardena, Wickramasinghe and Rajapaksa. The owner is Dr. Nirmala Perera.
  - 5 services: Consultation, Check-up, Cleaning, Treatment, Follow-up visit. Plus weekly working hours.
  - 5 logins, all `@ivora-demo.test`: `owner`, `reception.colombo`, `reception.nugegoda`, `reception.negombo`, `fernando`.
  - 12 fake patients (fake `077000xxxx` numbers), one Nugegoda closure about 3 days out, appointments from yesterday to +5 days (one cancelled), and simulated SMS rows for online bookings. Dates further out show no bookings.
  - It wipes all tables and every auth user ending in `@ivora-demo.test` first (so logins created from the owner screen are removed too), then re-inserts. It uses relative dates, so rerunning refreshes the schedule.
- **Staff login limits (demo only):** new logins must use an email ending in `@ivora-demo.test`, a password of 8 to 72 characters, and the app allows at most 15 logins in total.
- **Shared demo:** everyone uses the same data. After testing, put changes back or run `npm run seed`. Never leave a real-looking phone number in the demo.
- **Reset:** `npm run seed` resets the demo. A public site can get messy, so run it before showing the project to anyone.
- **SMS:** after an online booking, write the message to `sms_log`. The owner's admin page lists them as "SMS sent (simulated)", newest first, 200 at most. Wording is generic.

## Manual tests

Run after any change to booking, schedule or roles. Run `npm run seed` first.

1. **Double-booking:** try to book the same dentist at the same time twice. It must fail with the friendly message. The database guard itself can be proved with a SQL block in the Supabase SQL editor that tries an overlapping insert for the same dentist and must raise an exclusion violation. (A two-branch UI test is not possible with the seed hours, because Dr. Fernando works at Negombo and Colombo 7 on different weekdays.)
2. **Closure:** block Negombo for a whole day on `/owner`. That day must show no free times there, on both `/book` and reception's new booking. Remove the block afterwards.
3. **Notice period:** an online booking for 1 hour from now must be refused (no slot inside the next 2 hours is offered).
4. **Receptionist limit:** the Negombo receptionist must not see the other branches' bookings, including by putting another branch's booking id in `/reception/move?id=...` (it must bounce to `/reception?error=notfound`).
5. **Dentist limit:** Dr. Fernando sees only his own bookings, with no phone numbers.
6. **Role guard:** a receptionist opening an owner page must be refused.
7. **Browser keys:** a direct read of any table with the **publishable** key must return nothing (an empty list or "permission denied"). Send it in the `apikey` header only, and check that the key starts with `sb_publishable_` first. A secret key will return real rows, because it bypasses RLS. That proves nothing about RLS.
8. **SMS log:** a new online booking adds a row to the SMS log.

## Design

Simple and clean.
- Plain Tailwind, readable on a phone first (patients book on phones).
- Light theme only, Poppins font, one primary blue token `--primary`.
- Buttons at least 44px tall. Plain language in all text. Error messages say what to do.
- Dates and times shown in Colombo time, 12-hour with AM/PM. Known cosmetic gap: some time buttons show lowercase "am"/"pm" (`format.ts`). Not fixed on purpose.
- Do not rely on colour alone for status; always add a word.

## Status

**All planned phases and the README are done. The project is finished for portfolio use.**

- Project created, Supabase project created and linked, migrations 1 to 7 pushed.
- `scripts/seed.ts` written and working.
- Repo on GitHub, Vercel deployed from `main`, the three environment variables set in Vercel. The secret key has been rotated since it was exposed once.
- Server client, auth helpers, demo sign-in and sign-out, login page, demo banner, landing page.
- Public patient booking (`/book`, P1 to P6): `src/db/booking.ts` (`getBookingOptions`, `getAvailableSlots`). `generateSlots` / `getAvailableSlots` take optional `minNoticeMinutes` (default is the 2-hour online notice).
- Reception list, cancel and add (R1, R2): `src/db/reception.ts`, `src/db/reception-create.ts` (`createBranchBooking`, own branch only, `minNoticeMinutes: 0`, no SMS), screens `/reception` and `/reception/new` (commit `5608e9d`).
- Phase 2 (commit `68a2cf1`): Poppins, light theme, hairline `Settle` figure on the landing page.
- Phase 3 (commit `5e28d26`): receptionist move booking and delete patient data (rest of R1, R3). `moveBranchBooking` changes the times of the existing booking in one update (same service, same dentist, own branch, no notice rule, no SMS). `deleteBranchPatient` deletes the patient (bookings and SMS rows cascade) and refuses if the patient also has bookings at another branch.
- Phase 4 (commit `c3931e7`): dentist view (D1 to D3). `getOwnDentistBookings` never selects a phone number.
- Phase 5: owner screens (O1 to O4). `106b66d` week grid across branches with branch filter and week navigation. `4557abf` blocks with a two-step check, then save, and remove. SMS log at `/owner/sms`. Setup at `/owner/setup`: edit dentists (confirm when switching off with future bookings), services (name, duration), opening hours (confirm when future bookings fall outside). `/owner/staff`: list, create and deactivate logins (see "Demo behavior" for the limits).
- README rewritten (project label, live link, demo logins, what it shows, screenshots, stack, how to run, "What I'd add for a real client", credits).
- Manual tests run on the live site: 1 (also proved at database level), 2, 3, 4, 5, 6 and 8 passed. **Test 7 (browser keys) was not completed with the publishable key.** The first attempts used the secret key by mistake.

**Open items (all optional):**
1. Manual test 7 with the real publishable key.
2. Phase 6: custom hairline figures (max 3).
3. The lowercase "am" fix in `format.ts`.
4. Check the README screenshots show on GitHub, and the hairline link and MIT license in the README credits.

**Open questions:** one chair per dentist (unconfirmed).

## Not in scope (do not build unless asked)

Real SMS or WhatsApp, reminders, payments, mobile app, Sinhala or Tamil, patient self-service cancel or reschedule, no-show tracking, old-data import, two-factor login, PDPA tooling, treatment records, row-level-security policies, multi-chair or room rules, editing branches from the browser, any real patient data.

## Gotchas

- Running several commands on separate PowerShell lines does not stop when one fails. Use `&&` to chain them (PowerShell 7).
- The secret key bypasses all security. If it ever lands in a `NEXT_PUBLIC_` variable, in client code, in git or in a chat, rotate it in Supabase immediately (create a new key, delete the old one, update `.env.local` and Vercel, redeploy, run `npm run seed`).
- Key prefixes: secret keys start with `sb_secret_`, publishable keys with `sb_publishable_`. Using the wrong one in a test gives misleading results.
- `.env.local` must stay in `.gitignore`. Never commit keys. Add the same variables in Vercel's project settings.
- Vercel only reads environment variables when it builds. After changing them, redeploy. Vercel shows a "Needs Attention" badge on `SUPABASE_SECRET_KEY` and `DEMO_PASSWORD`; it is a hint to mark them Sensitive, not an error.
- Do not use Vercel's "Add Supabase" integration. It would create a new database and inject its own variable names. We use the existing `ivora-dental` project and our own variables.
- The Supabase CLI login is per account. If `npx supabase link` or `db push` shows other projects, you are logged into the wrong account: `npx supabase logout`, then `npx supabase login`. Never touch projects that are not `ivora-dental`.
- Supabase Auth rejects passwords shorter than 6 characters, so `DEMO_PASSWORD` must be at least 6.
- Sign-in must use its own throwaway Supabase client, never the shared secret-key client (see "Auth and sessions").
- Pages that read cookies must sit inside `<Suspense>` (see "Next.js rules").
- `npm audit` shows a few high-severity warnings from the toolchain. Do not run `npm audit fix --force`.
- LF/CRLF warnings from git on Windows are harmless.
- `project-structure.txt` (written by the owner's `struc` command) and `PROJECT-GUIDE.md` are git-ignored. Do not commit them. Delete `collected.txt` (written by file-collector scripts) before `git add .`.
- Postgres range overlap treats `[10:00, 11:00)` and `[11:00, 12:00)` as not overlapping, which is what we want (back-to-back is allowed). Use `tstzrange(start_at, end_at)` with the default `[)` bounds.
- `timestamptz` comes back from Supabase as a UTC ISO string. Convert to Asia/Colombo only when displaying. In the dashboard Table Editor, times show in UTC (9:00 AM Colombo = 03:30).
- Supabase free projects pause after about a week of no activity. Open the project before showing it to someone, or the first load fails.
- The repo is public. Never commit real data or secrets. The demo logins only hold fictional data.
- `npx supabase db push` applies to the **remote** project. There is no undo. Read the SQL and run `--dry-run` first.
'@

[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "CLAUDE.md"), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Done. CLAUDE.md replaced."