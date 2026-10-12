# Ivora Dental

A booking and scheduling web app for a fictional dental clinic with 3 branches (Colombo 7, Nugegoda, Negombo). It is a **labelled portfolio concept project**: no real client, no real patients, all data is fictional. Its job is to show that the hard parts work, live: no dentist double-booking across branches, three roles with different access, and a clean booking flow.

The app is deployed publicly with seeded dummy data. Anyone can open it and try it.

- Repo: `deelaka-ransilu/ivora-dental` (public), https://github.com/deelaka-ransilu/ivora-dental, branch `main`
- Live site: `TODO` (Vercel URL, fill in once the first real deploy is confirmed)
- Local folder: `E:\1-Active\ivora-dental` (Windows, PowerShell 7, VS Code)
- Origin: this started as a client-quote role-play. The requirements below came from it. Contract terms, PDPA clauses, support tiers and hosting-in-client's-name are **not** part of this build.

## How to work with the owner of this repo

- Keep explanations short, plain and step by step. Give exact commands for PowerShell. The owner types fast with many typos; read for intent.
- Direct and action-oriented. Ask for decisions, not just code. Give a recommended answer with each question.
- When walking through terminal commands, give one step, then wait for the output before saying more.
- Give **full file contents** for any new or replaced file, never partial snippets or diffs. One file at a time.
- Never change method internals without first seeing the actual file. If unseen files are needed, give a PowerShell file-collector script (one txt output, run from the project root). Write it by hand for this repo; the built-in file-collector skill is hard-wired to other repos.
- Prefer the simplest, most conservative option. Do not add libraries, services or abstractions "for later".
- When a screen is finished, tell the owner what to click to test it.
- Chain build and push so a failed build stops the push:
  `npm run build && git add . && git commit -m "message" && git push`
- Never hand over a placeholder as if it were finished. If something is a stand-in, say so.
- When the owner does not answer a question, say which default you picked, build that, and keep the rest as a proposal. Do not describe a proposed change as built.
- Never ask the owner to paste secrets in chat. Keys go in `.env.local` and Vercel's environment variables only.
- There is no `AGENTS.md` in this repo, by the owner's choice. Do not create one.

## Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, **server rendering** (not a static export), `src/` directory, `@/*` import alias |
| Styling | Tailwind CSS v4. Plain components first; add a component library only if the owner agrees |
| Database | PostgreSQL on Supabase (free tier), project `ivora-dental`, Asia-Pacific region |
| Migrations | **Supabase CLI** (dev dependency, run with `npx supabase`), plain SQL files in `supabase/migrations/` (see "Migrations") |
| DB access | `@supabase/supabase-js` on the **server only**, using the **new secret key** (`sb_secret_...`) |
| Auth | Supabase Auth (email + password). Demo sign-in buttons for the three roles |
| Hosting | Vercel (app) + Supabase (database) |
| SMS | **Simulated.** Messages are written to `sms_log`, shown in the admin as "SMS sent (simulated)". No provider |
| Dev tools | `tsx` (runs `scripts/seed.ts`) |

**Supabase project settings:** Data API on, "Automatically expose new tables" **OFF**, "Enable automatic RLS" **ON**.

**Keys:** use the new API keys only. The secret key goes in `SUPABASE_SECRET_KEY`. Ignore the legacy `anon` / `service_role` tab. The publishable key is not used anywhere in this app.

**Environment variables** (in `.env.local`, which is git-ignored, and in Vercel project settings):

| Name | Used by |
|---|---|
| `SUPABASE_URL` | server client and seed script |
| `SUPABASE_SECRET_KEY` | server client and seed script. Never `NEXT_PUBLIC_` |
| `DEMO_PASSWORD` | seed script (sets the demo logins' password, at least 6 characters) and the server-side demo login buttons |

## Commands

```
npm run dev       # local dev server at http://localhost:3000
npm run build     # production build (must pass before every push)
npm run lint      # ESLint
npm run seed      # wipe and re-insert the dummy data (tsx --env-file=.env.local scripts/seed.ts)

npx supabase migration new <name>   # create a new empty migration file
npx supabase db push --dry-run      # preview what would be applied
npx supabase db push                # apply pending migrations to the linked Supabase project
npx supabase migration list         # see which migrations are applied
```

There is no test suite. `npm run build` (which runs the TypeScript check) is the main safety net, plus a manual double-booking test (see "Manual tests").

## Migrations

**The database schema lives only in migration files. Never change the schema by clicking in the Supabase dashboard.**

1. All schema changes are SQL files in `supabase/migrations/`, named by the CLI (`<timestamp>_<name>.sql`). Create one with `npx supabase migration new <name>`.
2. **Never edit a migration that has already been pushed.** Write a new migration that changes things forward.
3. Work against the **remote** project with `npx supabase link` then `npx supabase db push`. We do not use local Supabase (it needs Docker). One Supabase project, no staging.
4. Migrations contain structure only: tables, constraints, indexes, extensions. **Demo data is not in migrations.** It lives in `scripts/seed.ts`.
5. One concern per migration, small and named by what it does.
6. Workflow per migration: `migration new <name>`, paste the full SQL, `db push --dry-run`, `db push`, `migration list` (local and remote must match).
7. If a migration fails halfway, read the error and write a fix as a new migration. Do not hand-edit the remote database to "repair" it.
8. **Every new table needs its own RLS and `service_role` grant lines in its own migration.** Auto-expose is off, so a new table is unreachable by the server key until it is granted.

**Applied migrations (all pushed, local = remote):**

1. `20261012142704_extensions_and_enums`: `btree_gist` (in the `extensions` schema), enums `user_role` (`owner`, `receptionist`, `dentist`) and `appointment_status` (`booked`, `cancelled`).
2. `20261012143058_core_tables`: `branches`, `dentists`, `services` (duration > 0 and a multiple of 5), `dentist_services`, `dentist_branch_hours` (`day_of_week` 0 = Sunday, local `time` columns). `is_active` is used instead of deleting.
3. `20261012143137_profiles`: `id` = the Supabase Auth user id; `role`, `branch_id`, `dentist_id` (unique), `is_active`. A check constraint ties the role to its branch/dentist links.
4. `20261012143212_patients_and_appointments`: `patients` (name, phone, consent timestamp), `appointments`, with the exclusion constraint `appointments_no_dentist_overlap`. Deleting a patient cascades to their appointments.
5. `20261012143251_blocked_times`: exactly one of `branch_id` or `dentist_id`, a time range, a reason.
6. `20261012143351_sms_log`: `appointment_id` (cascade), `to_phone`, `message`.
7. `20261012143458_rls_and_grants`: RLS enabled on all 10 tables with no policies; all privileges revoked from `anon` and `authenticated`; usage and all on tables granted to `service_role`.

## Project structure

Exists now: `supabase/migrations/`, `scripts/seed.ts`, and the create-next-app skeleton in `src/app`. Everything else under `src/` below is **planned, not built.** Update this section as files are created.

```
supabase/
  config.toml
  migrations/               the schema, as SQL files (see "Migrations")
scripts/
  seed.ts                   wipes and re-inserts dummy data. Demo only
src/
  app/
    layout.tsx
    page.tsx                simple landing page: what this is, link to booking, demo sign-in
    book/page.tsx           public patient booking page
    login/page.tsx          sign-in with the three demo buttons
    dashboard/              receptionist and owner screens (role-checked)
    dentist/page.tsx        dentist read-only view
    admin/                  owner only: dentists, services, hours, closures, SMS log
  components/               shared UI
  lib/
    supabase-server.ts      the ONLY place the secret-key client is created
    auth.ts                 current user and role, requireRole()
    rules.ts                booking rules: notice period, slot generation, closures
    format.ts               dates in Asia/Colombo, phone formatting
  db/                       small query functions. Screens call these, not supabase directly
```

## Architecture rules

1. **All database access is on the server** (server components, server actions, route handlers). The secret key is in `SUPABASE_SECRET_KEY`, never prefixed with `NEXT_PUBLIC_`, never imported into a client component.
2. **Every server action and page checks the role first** with `requireRole()` from `lib/auth.ts`. Hiding a button is not security.
3. **Row-level security is enabled on every table with no policies**, and `anon` / `authenticated` have no privileges. The browser-side keys can read and write nothing. The server uses the secret key (`service_role`), which bypasses RLS. We do not write RLS policies in v1. Access control is done in server code.
4. **The double-booking rule lives in the database**, as an exclusion constraint (see "Data model"). Server code also checks first to give a friendly message, but the constraint is the real guard. If the insert fails with an exclusion violation, show "That time was just taken. Please pick another."
5. **Time is stored as `timestamptz` and shown in `Asia/Colombo`** (UTC+5:30, no daylight saving). Do not store local strings. Conversion to and from Colombo time happens only in `lib/format.ts`. Working hours are the exception: they are local `time` columns by design.
6. **Booking rules live in `lib/rules.ts`** (notice period, slot generation, closure checks). Do not re-implement them inside a page.
7. **Roles and branch limits are enforced in `src/db/` query functions**, which take the current user. A receptionist's queries always filter by their own branch. A dentist's queries always filter by their own dentist id.
8. **Dentists never see patient phone numbers.** Their view returns name, time, service and branch only. Do not add phone to that query.
9. **No treatment details anywhere.** Service names are generic. Never add a notes or diagnosis field.
10. **Schema changes only through migrations** (see "Migrations").
11. **Keep demo and app apart.** Demo-only behavior (demo sign-in buttons, demo banner, `seed.ts`) goes in clearly named files so it can be deleted for a real install. Nothing in the core booking code may import from them.
12. **Do not add libraries without asking.** Check the existing dependencies first.

## Data model (PostgreSQL)

| Table | Purpose |
|---|---|
| `branches` | Name, address, phone, opening hours |
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
- O2. Set up branches, dentists, services and working hours.
- O3. Block a branch or a dentist for a day.
- O4. Create and remove staff logins and control what each can see.

**System rules**
- S1. A dentist cannot be booked in two places at the same time.
- S2. Each service has a fixed duration. No buffer or cleaning time.
- S3. Each person has their own login. Receptionists see only their branch, dentists only their own bookings, only the owner has full access.
- S5. No treatment details stored or sent anywhere.
- S7. Public pages: a simple home page and the booking page, English only.

**Skipped on purpose for the portfolio build** (list them in the README under "What I'd add for a real client"): two-factor login for the owner, real SMS provider, backups beyond what Supabase gives, PDPA review and retention policy, reminders.

**OUT or LATER:** WhatsApp API messages, reminders, payments, mobile app, old-data import, Sinhala/Tamil, patient self-service cancel or reschedule, no-show tracking.

## Demo behavior

- **Sign-in:** the login page has three buttons: **Owner**, **Receptionist (Negombo)** and **Dr. Fernando**. Each signs in as a seeded Supabase Auth user. The accounts only hold fictional data. This is a convenience for visitors, not security. The password is `DEMO_PASSWORD`, used only on the server by the demo login buttons; it is not shown anywhere on the site.
- **Banner:** every page shows "Demo with fictional data. Please don't enter real details." The booking form shows it too.
- **Seed data** (`scripts/seed.ts`), what it creates:
  - 3 branches and 5 dentists. Dr. Anura Fernando works at Negombo and Colombo 7. The others are Silva, Jayawardena, Wickramasinghe and Rajapaksa.
  - 5 services: Consultation, Check-up, Cleaning, Treatment, Follow-up visit. Plus weekly working hours.
  - 5 logins, all `@ivora-demo.test`: `owner`, `reception.colombo`, `reception.nugegoda`, `reception.negombo`, `fernando`.
  - 12 fake patients (fake `077000xxxx` numbers), one Nugegoda closure about 3 days out, appointments from yesterday to +5 days (one cancelled), and simulated SMS rows for online bookings.
  - It wipes all tables and the demo auth users first, then re-inserts. It uses relative dates, so rerunning refreshes the schedule.
- **Reset:** `npm run seed` resets the demo. A public site can get messy, so run it before showing the project to anyone.
- **SMS:** after a booking, write the message to `sms_log`. The owner's admin page lists them as "SMS sent (simulated)". Wording is generic, for example "Your appointment at Ivora Negombo is on Tue 3:00 PM. Call 0XX to change."

## Manual tests

Run after any change to booking, schedule or roles. Run `npm run seed` first.

1. **Double-booking:** book Dr. Fernando at 10:00 at Negombo. Try to book him at 10:00 at his other branch. It must fail with the friendly message.
2. **Closure:** block Negombo for a day. That day must show no free times there.
3. **Notice period:** an online booking for 1 hour from now must be refused.
4. **Receptionist limit:** the Negombo receptionist must not see the other branches' bookings, including by changing the URL.
5. **Dentist limit:** Dr. Fernando sees only his own bookings, with no phone numbers.
6. **Role guard:** a receptionist opening an owner page must be refused.
7. **Browser keys:** a direct read of any table with a browser-side key (publishable or legacy anon) must return nothing.
8. **SMS log:** a new booking adds a row to `sms_log`.

## Design

Simple and clean. No design system decided yet.
- Plain Tailwind, readable on a phone first (patients book on phones).
- Buttons at least 44px tall. Plain language in all text. Error messages say what to do.
- Dates and times shown in Colombo time, 12-hour with AM/PM.
- Do not rely on colour alone for status; always add a word.

## Status

Done: project created, Supabase project created and linked, migrations 1 to 7 pushed, `scripts/seed.ts` written and run successfully (3 branches, 5 dentists, 5 services, 5 logins, 12 patients, 49 appointments, 17 simulated SMS), data checked in the Supabase dashboard, repo pushed to GitHub, Vercel project imported from GitHub.

**Open items, in the agreed order:**
1. Supabase server client (`lib/supabase-server.ts`), `requireRole()` (`lib/auth.ts`), login page with the demo buttons.
2. Patient booking page (P1 to P6) with slot generation in `lib/rules.ts`.
3. Receptionist dashboard (R1 to R3).
4. Dentist view (D1 to D3). If time is short, cut this first.
5. Owner screens: dentists, services, hours, closures, SMS log (O1 to O4).
6. Add the three environment variables in Vercel, deploy, run the manual tests on the live site, fill in the live URL above.
7. README with screenshots, the "What I'd add for a real client" section, and a clear "concept project, fictional data" label.

**Small cleanups:** `project-structure.txt` was committed by accident (remove with `git rm`).

**Open questions:** one chair per dentist (unconfirmed); plain Tailwind vs a component library; final live URL.

## Not in scope (do not build unless asked)

Real SMS or WhatsApp, reminders, payments, mobile app, Sinhala or Tamil, patient self-service cancel or reschedule, no-show tracking, old-data import, two-factor login, PDPA tooling, treatment records, row-level-security policies, multi-chair or room rules, any real patient data.

## Gotchas

- Running several commands on separate PowerShell lines does not stop when one fails. Use `&&` to chain them (PowerShell 7).
- The secret key bypasses all security. If it ever lands in a `NEXT_PUBLIC_` variable, in client code or in git, rotate it in Supabase immediately.
- `.env.local` must stay in `.gitignore`. Never commit keys. Add the same variables in Vercel's project settings.
- Do not use Vercel's "Add Supabase" integration. It would create a new database and inject its own variable names. We use the existing `ivora-dental` project and our own variables.
- The Supabase CLI login is per account. If `npx supabase link` or `db push` shows other projects, you are logged into the wrong account: `npx supabase logout`, then `npx supabase login`. Never touch projects that are not `ivora-dental`.
- Supabase Auth rejects passwords shorter than 6 characters, so `DEMO_PASSWORD` must be at least 6.
- `npm audit` shows a few high-severity warnings from the toolchain. Do not run `npm audit fix --force`.
- Postgres range overlap treats `[10:00, 11:00)` and `[11:00, 12:00)` as not overlapping, which is what we want (back-to-back is allowed). Use `tstzrange(start_at, end_at)` with the default `[)` bounds.
- `timestamptz` comes back from Supabase as a UTC ISO string. Convert to Asia/Colombo only when displaying. In the dashboard Table Editor, times show in UTC (9:00 AM Colombo = 03:30).
- Supabase free projects pause after about a week of no activity. Open the project before showing it to someone, or the first load fails.
- The repo is public. Never commit real data or secrets. The demo logins only hold fictional data.
- `npx supabase db push` applies to the **remote** project. There is no undo. Read the SQL and run `--dry-run` first.