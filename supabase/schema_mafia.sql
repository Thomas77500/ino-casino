-- Ino Casino — Arc Parrain de Quartier (roulette de territoire + 5 saisons de règne + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Parrains — un enregistrement par règne terminé (passé en paix ou démantelé).
-- ============================================================================
create table if not exists public.mafia_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  territory_id text not null,
  territory_label text not null,
  outcome_label text not null,
  respect int not null,
  recettes bigint not null,
  payout bigint not null,
  busted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.mafia_records enable row level security;

drop policy if exists "mafia_records_select_all" on public.mafia_records;
create policy "mafia_records_select_all" on public.mafia_records for select
  to authenticated using (true);

drop policy if exists "mafia_records_insert_self" on public.mafia_records;
create policy "mafia_records_insert_self" on public.mafia_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Le Bar du Quartier" — même forme que club_messages/sect_messages.
-- ============================================================================
create table if not exists public.mafia_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.mafia_messages enable row level security;

drop policy if exists "mafia_messages_select_all" on public.mafia_messages;
create policy "mafia_messages_select_all" on public.mafia_messages for select
  to authenticated using (true);

drop policy if exists "mafia_messages_insert_self" on public.mafia_messages;
create policy "mafia_messages_insert_self" on public.mafia_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" dans le
-- panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('mafia', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mafia_records') then
    alter publication supabase_realtime add table public.mafia_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mafia_messages') then
    alter publication supabase_realtime add table public.mafia_messages;
  end if;
end $$;
