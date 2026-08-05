-- Ino Casino — admin user management + real dynamic leaderboard.
-- Run this once in Supabase Dashboard → SQL Editor (after schema_admin.sql and schema_progress.sql).

-- ============================================================================
-- Soft-ban flag — checked client-side on login to block access. Only admins can flip it
-- (see the update policy below); users can't self-unban via profiles_update_self because that
-- policy only lets them change their OWN row, and this new admin policy is additive, not a
-- replacement — RLS OR-combines every matching policy, so a non-admin still can't touch it.
-- ============================================================================
alter table public.profiles add column if not exists banned boolean not null default false;

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update
  to authenticated using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ============================================================================
-- casino_progress: make sure it's readable by everyone (needed for the leaderboard) and give
-- admins write access (needed for the credit-adjustment tool) even if schema_progress.sql was
-- already run with the older, owner-only select policy.
-- ============================================================================
drop policy if exists "casino_progress_select_own" on public.casino_progress;

drop policy if exists "casino_progress_select_all" on public.casino_progress;
create policy "casino_progress_select_all" on public.casino_progress for select
  to authenticated using (true);

drop policy if exists "casino_progress_update_admin" on public.casino_progress;
create policy "casino_progress_update_admin" on public.casino_progress for update
  to authenticated using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ============================================================================
-- New game_status row for the case-opening game
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('cases', true, '')
on conflict (id) do nothing;

insert into public.game_status (id, enabled, message) values ('pmu', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — the leaderboard refetches live on any new signup or progress change.
-- Guarded so re-running this whole file never aborts partway through if a previous attempt
-- already added one of these tables (`alter publication ... add table` has no IF NOT EXISTS).
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casino_progress') then
    alter publication supabase_realtime add table public.casino_progress;
  end if;
end $$;
