-- Ino Casino — Arc Président de Club (roulette de reprise + présidence de 5 saisons + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Présidents — un enregistrement par présidence terminée (réélu ou démis).
-- ============================================================================
create table if not exists public.club_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id text not null,
  club_label text not null,
  outcome_label text not null,
  support int not null,
  budget int not null,
  payout bigint not null,
  ousted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.club_records enable row level security;

drop policy if exists "club_records_select_all" on public.club_records;
create policy "club_records_select_all" on public.club_records for select
  to authenticated using (true);

drop policy if exists "club_records_insert_self" on public.club_records;
create policy "club_records_insert_self" on public.club_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Vestiaire des Présidents" — même forme que pmu_messages/ministry_messages.
-- ============================================================================
create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.club_messages enable row level security;

drop policy if exists "club_messages_select_all" on public.club_messages;
create policy "club_messages_select_all" on public.club_messages for select
  to authenticated using (true);

drop policy if exists "club_messages_insert_self" on public.club_messages;
create policy "club_messages_insert_self" on public.club_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" (qui pilote
-- aussi la chance de succès d'un soudoiement) dans le panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('club', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_records') then
    alter publication supabase_realtime add table public.club_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_messages') then
    alter publication supabase_realtime add table public.club_messages;
  end if;
end $$;
