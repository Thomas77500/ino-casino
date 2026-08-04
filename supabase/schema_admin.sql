-- Ino Casino — admin + game maintenance schema.
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run (after schema.sql).

-- ============================================================================
-- admins
-- ============================================================================
-- Deliberately NOT a boolean column on `profiles`: that table has a
-- "profiles_update_self" policy letting users update their own row, and an
-- `is_admin` column there would let anyone grant themselves admin with one
-- `update profiles set is_admin = true where id = auth.uid()` call. A separate
-- table with NO insert/update/delete policy at all closes that off completely —
-- the only way to add an admin is from the SQL Editor (or another
-- service-role connection), never from the browser.
create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

alter table public.admins enable row level security;

-- Each user may only check their OWN admin status (not list the full roster).
create policy "admins_select_self" on public.admins for select
  to authenticated using (user_id = auth.uid());

-- ============================================================================
-- game_status — feature flags the admin panel toggles, every client reads
-- ============================================================================
create table public.game_status (
  id text primary key,
  enabled boolean not null default true,
  message text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.game_status enable row level security;

create policy "game_status_select_all" on public.game_status for select
  to authenticated using (true);

create policy "game_status_update_admin" on public.game_status for update
  to authenticated
  using (exists (select 1 from public.admins where user_id = auth.uid()));

insert into public.game_status (id, enabled, message) values
  ('slots', true, ''),
  ('blackjack', true, ''),
  ('roulette', true, ''),
  ('chickenroad', true, ''),
  ('plinko', true, ''),
  ('crash', true, ''),
  ('scratch', true, ''),
  ('bourse', true, ''),
  ('braquage', true, '')
on conflict (id) do nothing;

alter publication supabase_realtime add table public.game_status;

-- ============================================================================
-- Make yourself admin — run this LAST, with your own username:
-- ============================================================================
-- insert into public.admins (user_id)
-- select id from public.profiles where username_lower = 'ton_pseudo_en_minuscules';
