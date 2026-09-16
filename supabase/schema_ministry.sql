-- Ino Casino — Arc Ministériel (roulette de nomination + mandat de 5 ans + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Ministres — un enregistrement par mandat terminé (réélu ou censuré).
-- ============================================================================
create table if not exists public.ministry_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ministry_id text not null,
  ministry_label text not null,
  outcome_label text not null,
  popularity int not null,
  treasury int not null,
  payout bigint not null,
  censured boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ministry_records enable row level security;

drop policy if exists "ministry_records_select_all" on public.ministry_records;
create policy "ministry_records_select_all" on public.ministry_records for select
  to authenticated using (true);

drop policy if exists "ministry_records_insert_self" on public.ministry_records;
create policy "ministry_records_insert_self" on public.ministry_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Conseil des Ministres" — même forme que pmu_messages/lobby_messages.
-- ============================================================================
create table if not exists public.ministry_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.ministry_messages enable row level security;

drop policy if exists "ministry_messages_select_all" on public.ministry_messages;
create policy "ministry_messages_select_all" on public.ministry_messages for select
  to authenticated using (true);

drop policy if exists "ministry_messages_insert_self" on public.ministry_messages;
create policy "ministry_messages_insert_self" on public.ministry_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" (qui pilote
-- aussi la chance de succès d'un soudoiement) dans le panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('ministry', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ministry_records') then
    alter publication supabase_realtime add table public.ministry_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ministry_messages') then
    alter publication supabase_realtime add table public.ministry_messages;
  end if;
end $$;
