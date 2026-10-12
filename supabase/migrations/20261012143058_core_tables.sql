-- Migration 2: core tables

create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  address    text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.dentists (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Fixed duration per service, no buffer time (S2).
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes % 5 = 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Which services each dentist offers.
create table public.dentist_services (
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (dentist_id, service_id)
);

-- Weekly hours per dentist per branch. day_of_week: 0 = Sunday ... 6 = Saturday.
-- Times are local clinic time (Asia/Colombo), so plain `time`, not timestamptz.
-- A dentist can have more than one row for the same day (split shifts).
create table public.dentist_branch_hours (
  id          uuid primary key default gen_random_uuid(),
  dentist_id  uuid not null references public.dentists(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);

create index dentist_branch_hours_dentist_idx on public.dentist_branch_hours (dentist_id);
create index dentist_branch_hours_branch_idx  on public.dentist_branch_hours (branch_id);
