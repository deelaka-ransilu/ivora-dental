-- Migration 7: RLS on every table (no policies) + server key access

alter table public.branches             enable row level security;
alter table public.dentists             enable row level security;
alter table public.services             enable row level security;
alter table public.dentist_services     enable row level security;
alter table public.dentist_branch_hours enable row level security;
alter table public.profiles             enable row level security;
alter table public.patients             enable row level security;
alter table public.appointments         enable row level security;
alter table public.blocked_times        enable row level security;
alter table public.sms_log              enable row level security;

-- No policies on purpose: the anon and authenticated keys can read nothing.
-- Remove any access those roles might have had, to be safe.
revoke all on all tables in schema public from anon, authenticated;

-- The server (secret key = service_role) bypasses RLS but still needs table privileges.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;