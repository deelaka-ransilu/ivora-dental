# Ivora Dental

A booking and scheduling web app for a **fictional** dental clinic with three branches (Colombo 7, Nugegoda, Negombo).

> **Concept project, fictional data.** There is no real clinic, no real patients and no real SMS. Everything you see is dummy data. Please don't enter real details.

**Live demo:** https://ivora-dental.vercel.app

## Try it

Open the live demo, go to **/login** and use one of the three demo buttons. No password is needed.

| Button | What you can do |
|---|---|
| **Owner** | See one schedule across all 3 branches, block a branch or dentist, edit dentists, services and opening hours, manage staff logins, read the (simulated) SMS log |
| **Receptionist (Negombo)** | See and manage bookings for their own branch only: add phone and walk-in bookings, move, cancel, delete a patient's data |
| **Dr. Fernando** | Read-only view of their own bookings across all their branches. No phone numbers, no buttons to change anything |

Patients can book without signing in at **/book**: pick a branch, a service and a free time, then give a name and phone number.

The demo is shared by everyone, so it may look messy if other people have been testing it.

## What it shows

1. **No double-booking.** A dentist cannot be booked twice at overlapping times, even across branches. The rule is enforced by the database (a PostgreSQL exclusion constraint), not only by the app, so a bug in the code cannot break it.
2. **Three roles, three different views.** Owner, receptionist and dentist each see only what they should. Access is checked on the server for every page and action. Hiding a button is not treated as security.
3. **A clean booking flow.** Works on a phone, needs only a name and a phone number, asks for consent, and respects a 2-hour notice for online bookings.

## Screenshots

![Owner week schedule across branches](docs/screenshots/owner-week.png)

![Patient booking page with free times](docs/screenshots/booking.png)

![Dentist read-only view](docs/screenshots/dentist.png)

## Built with

- Next.js 16 (App Router, server rendering), TypeScript, Tailwind CSS v4
- PostgreSQL on Supabase (database and auth)
- Vercel (hosting)

How it is put together:

- All database access happens on the server only, with row-level security turned on and no public policies.
- Times are stored in UTC and shown in Colombo time.
- The database schema lives only in migration files (`supabase/migrations/`). Demo data lives only in `scripts/seed.ts`.
- Demo-only parts (demo login buttons, demo banner, seed script) are kept separate so they can be removed for a real install.

`CLAUDE.md` holds the full spec, architecture rules and manual test list.

## Run it yourself

1. Create a free Supabase project and link it: `npx supabase link`
2. Apply the schema: `npx supabase db push`
3. Create `.env.local` with these three variables:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (server only, never expose it)
   - `DEMO_PASSWORD` (at least 6 characters)
4. Install and load the demo data: `npm install` then `npm run seed`
5. Start it: `npm run dev` and open http://localhost:3000

`npm run seed` wipes and recreates all the demo data, so only point it at a demo project.

## What I'd add for a real client

This is a portfolio build, so some things are left out on purpose:

- Two-factor login for the owner
- A real SMS provider (messages are only written to a log here)
- Reminders for patients
- Backups beyond what Supabase gives by default
- A data protection review (PDPA) and a retention policy
- Editing branches from the browser
- Hosting and accounts in the client's own name

## Credits

- Line art figures: [@lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) (MIT license)
- Built by Dee ([deelaka-ransilu](https://github.com/deelaka-ransilu))
