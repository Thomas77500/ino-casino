-- Ino Casino — Bookmaker Clandestin (fixe les cotes, encaisse les mises, gère les mauvais payeurs).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql, schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.
-- Pas de table de parties ici : comme Blanchiment, chaque livre se résout entièrement côté client
-- (aucun état à synchroniser entre joueurs, contrairement à la Table Clandestine).

-- ============================================================================
-- Chat "Le Carnet" — même forme que les autres salons.
-- ============================================================================
create table if not exists public.bookmaker_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.bookmaker_messages enable row level security;

drop policy if exists "bookmaker_messages_select_all" on public.bookmaker_messages;
create policy "bookmaker_messages_select_all" on public.bookmaker_messages for select
  to authenticated using (true);

drop policy if exists "bookmaker_messages_insert_self" on public.bookmaker_messages;
create policy "bookmaker_messages_insert_self" on public.bookmaker_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — maintenance + curseur "Probabilité de gain" (pilote le résultat du match quand
-- il s'écarte du tirage naturel, comme la roulette).
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('bookmaker', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — chat en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookmaker_messages') then
    alter publication supabase_realtime add table public.bookmaker_messages;
  end if;
end $$;
