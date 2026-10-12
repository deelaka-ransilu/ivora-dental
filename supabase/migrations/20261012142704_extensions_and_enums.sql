-- Migration 1: extensions and enums

-- Needed later for the "one dentist, one time slot" rule (exclusion constraint on appointments).
create extension if not exists btree_gist with schema extensions;

-- Who a staff login is.
create type public.user_role as enum ('owner', 'receptionist', 'dentist');

-- Appointment state. Moving a booking changes its times; cancelling sets 'cancelled'.
-- Patient data deletion (R3) removes rows, so there is no 'deleted' state.
create type public.appointment_status as enum ('booked', 'cancelled');