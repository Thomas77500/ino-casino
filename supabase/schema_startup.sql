-- Ino Casino — Arc Licorne Frauduleuse (roulette de secteur + 5 tours de table + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Fondateurs — un enregistrement par startup terminée (vendue en paix ou mise en examen).
-- ============================================================================
create table if not exists public.startup_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sector_id text not null,
  sector_label text not null,
  outcome_label text not null,
  hype int not null,
  funding bigint not null,
  payout bigint not null,
  busted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.startup_records enable row level security;

drop policy if exists "startup_records_select_all" on public.startup_records;
create policy "startup_records_select_all" on public.startup_records for select
  to authenticated using (true);

drop policy if exists "startup_records_insert_self" on public.startup_records;
create policy "startup_records_insert_self" on public.startup_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Salle du Board" — même forme que club_messages/sect_messages.
-- ============================================================================
create table if not exists public.startup_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.startup_messages enable row level security;

drop policy if exists "startup_messages_select_all" on public.startup_messages;
create policy "startup_messages_select_all" on public.startup_messages for select
  to authenticated using (true);

drop policy if exists "startup_messages_insert_self" on public.startup_messages;
create policy "startup_messages_insert_self" on public.startup_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" dans le
-- panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('startup', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'startup_records') then
    alter publication supabase_realtime add table public.startup_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'startup_messages') then
    alter publication supabase_realtime add table public.startup_messages;
  end if;
end $$;
