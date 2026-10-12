-- Migration 4: patients and appointments

-- Only what the booking needs: name, phone, consent (P2, P3, S5). No treatment details.
create table public.patients (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  phone               text not null,
  consent_given_at    timestamptz not null,
  created_at          timestamptz not null default now()
);

create index patients_phone_idx on public.patients (phone);

create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  branch_id   uuid not null references public.branches(id),
  dentist_id  uuid not null references public.dentists(id),
  service_id  uuid not null references public.services(id),
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  status      public.appointment_status not null default 'booked',
  source      text not null default 'online' check (source in ('online', 'phone', 'walk_in')),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),

  check (end_at > start_at),

  -- S1: one dentist cannot have two booked appointments overlapping in time,
  -- even across different branches. Cancelled bookings don't block anything.
  constraint appointments_no_dentist_overlap
    exclude using gist (
      dentist_id with =,
      tstzrange(start_at, end_at) with &&
    ) where (status = 'booked')
);

create index appointments_branch_start_idx  on public.appointments (branch_id, start_at);
create index appointments_dentist_start_idx on public.appointments (dentist_id, start_at);
create index appointments_patient_idx       on public.appointments (patient_id);