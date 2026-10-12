-- Migration 5: blocked_times (closures, O3)

-- Blocks either a whole branch or one dentist for a time range.
-- Exactly one of branch_id / dentist_id is set.
create table public.blocked_times (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references public.branches(id) on delete cascade,
  dentist_id  uuid references public.dentists(id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  reason      text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),

  check (end_at > start_at),
  check ((branch_id is not null)::int + (dentist_id is not null)::int = 1)
);

create index blocked_times_branch_start_idx  on public.blocked_times (branch_id, start_at);
create index blocked_times_dentist_start_idx on public.blocked_times (dentist_id, start_at);