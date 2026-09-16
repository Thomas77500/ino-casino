-- Ino Casino — Arc Gourou (roulette de fondation + 5 saisons de recrutement + Palmarès + chat).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin_users.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Palmarès des Gourous — un enregistrement par mouvement terminé (transmis en paix ou démantelé).
-- ============================================================================
create table if not exists public.sect_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cult_id text not null,
  cult_label text not null,
  outcome_label text not null,
  influence int not null,
  dons bigint not null,
  payout bigint not null,
  raided boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sect_records enable row level security;

drop policy if exists "sect_records_select_all" on public.sect_records;
create policy "sect_records_select_all" on public.sect_records for select
  to authenticated using (true);

drop policy if exists "sect_records_insert_self" on public.sect_records;
create policy "sect_records_insert_self" on public.sect_records for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Chat "Cercle Intérieur" — même forme que club_messages/ministry_messages.
-- ============================================================================
create table if not exists public.sect_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.sect_messages enable row level security;

drop policy if exists "sect_messages_select_all" on public.sect_messages;
create policy "sect_messages_select_all" on public.sect_messages for select
  to authenticated using (true);

drop policy if exists "sect_messages_insert_self" on public.sect_messages;
create policy "sect_messages_insert_self" on public.sect_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — active le toggle maintenance + le curseur "Probabilité de gain" (qui pilote
-- aussi la chance de succès d'un achat de silence) dans le panneau admin, gratuitement.
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('sect', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — Palmarès et chat se mettent à jour en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sect_records') then
    alter publication supabase_realtime add table public.sect_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sect_messages') then
    alter publication supabase_realtime add table public.sect_messages;
  end if;
end $$;
