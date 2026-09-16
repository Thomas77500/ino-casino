-- Ino Casino — Centre de notifications (dons reçus, demandes d'amis, demandes acceptées).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) between 1 and 500),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Every notification is a self-insert: each store writes into the current user's own feed in
-- reaction to a realtime event it's already allowed to see (gift received, friend request that
-- names them) — no cross-user insert surface, same pattern as every other table in this app.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update
  to authenticated using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
