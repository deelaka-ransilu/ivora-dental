-- Migration 3: profiles (one row per staff login)

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null,
  branch_id   uuid references public.branches(id),
  dentist_id  uuid unique references public.dentists(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),

  -- Receptionists belong to exactly one branch (S3).
  -- Dentists are linked to a dentist record and have no branch of their own.
  -- The owner has neither.
  constraint profiles_role_links check (
    (role = 'owner'        and branch_id is null     and dentist_id is null) or
    (role = 'receptionist' and branch_id is not null and dentist_id is null) or
    (role = 'dentist'      and branch_id is null     and dentist_id is not null)
  )
);

create index profiles_branch_idx on public.profiles (branch_id);