-- Ino Casino — Arc Zone 51 (roulette de programme + 5 années de confinement + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Directeurs de Programme — un enregistrement par programme terminé (enterré en paix
-- ou révélé au public).
-- ============================================================================
create table if not exists public.area51_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id text not null,
  program_label text not null,
  outcome_label text not null,
  control int not null,
  budget bigint not null,
  payout bigint not null,
  busted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.area51_records enable row level security;

drop policy if exists "area51_records_select_all" on public.area51_records;
create policy "area51_records_select_all" on public.area51_records for select
  to authenticated using (true);

drop policy if exists "area51_records_insert_self" on public.area51_records;
create policy "area51_records_insert_self" on public.area51_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Mess des Officiers" — même forme que club_messages/sect_messages.
-- ============================================================================
create table if not exists public.area51_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.area51_messages enable row level security;

drop policy if exists "area51_messages_select_all" on public.area51_messages;
create policy "area51_messages_select_all" on public.area51_messages for select
  to authenticated using (true);

drop policy if exists "area51_messages_insert_self" on public.area51_messages;
create policy "area51_messages_insert_self" on public.area51_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" dans le
-- panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('area51', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'area51_records') then
    alter publication supabase_realtime add table public.area51_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'area51_messages') then
    alter publication supabase_realtime add table public.area51_messages;
  end if;
end $$;
