-- Migration 6: sms_log (simulated SMS, P4)

-- No real SMS provider. Messages are written here and shown in admin as "SMS sent (simulated)".
-- Generic wording only, no treatment details (S5).
create table public.sms_log (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references public.appointments(id) on delete cascade,
  to_phone        text not null,
  message         text not null,
  created_at      timestamptz not null default now()
);

create index sms_log_appointment_idx on public.sms_log (appointment_id);