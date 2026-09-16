-- Ino Casino — Table Clandestine (multijoueur en temps réel) + ardoises de dettes entre joueurs.
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql, schema_progress.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.

-- ============================================================================
-- Rounds — une seule table clandestine partagée par tout le monde (pas de salons multiples : le
-- premier arbitrage demandé côté produit). Le `crash_point` est tiré et écrit par le client qui
-- démarre la manche (même modèle de confiance que tous les autres RNG de ce casino — voir
-- crashEngine.ts). Aucun statut à maintenir : chaque client déduit la phase (mise / en cours /
-- terminée) localement à partir de `starts_at` + `crash_point`, comme Crash.tsx le fait déjà.
-- ============================================================================
create table if not exists public.darktable_rounds (
  id uuid primary key default gen_random_uuid(),
  crash_point numeric not null,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Several round formats now share this one table instead of Crash running on repeat: `game_type`
-- picks the format, `crash_point` stays Crash's growth target (now nullable — unused by the other
-- formats), `outcome` holds roulette's winning number (0-36) or dice's roll (0-100).
alter table public.darktable_rounds add column if not exists game_type text not null default 'crash';
alter table public.darktable_rounds add column if not exists outcome numeric;
alter table public.darktable_rounds alter column crash_point drop not null;

alter table public.darktable_rounds enable row level security;

drop policy if exists "darktable_rounds_select_all" on public.darktable_rounds;
create policy "darktable_rounds_select_all" on public.darktable_rounds for select
  to authenticated using (true);

drop policy if exists "darktable_rounds_insert_any" on public.darktable_rounds;
create policy "darktable_rounds_insert_any" on public.darktable_rounds for insert
  to authenticated with check (true);

-- ============================================================================
-- Mises — chaque joueur ne touche que sa propre mise (les crédits misés/gagnés restent gérés en
-- local côté client, exactement comme Crash : ici le multijoueur, c'est "la même manche vue par
-- tout le monde", pas une cagnotte partagée entre joueurs).
-- ============================================================================
create table if not exists public.darktable_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.darktable_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  cashed_out_multiplier numeric,
  payout bigint,
  created_at timestamptz not null default now()
);

-- Roulette/dice bets carry a `choice` (e.g. "rouge"/"sous") picked before reveal instead of a
-- cash-out action; a winning bet still gets its multiplier/payout written into the two columns
-- above (self-write, same as Crash's cash-out), a losing one is simply left null forever — the
-- existing "still null when the round ended = lost" convention already covers it, no extra state needed.
alter table public.darktable_bets add column if not exists choice text;

alter table public.darktable_bets enable row level security;

drop policy if exists "darktable_bets_select_all" on public.darktable_bets;
create policy "darktable_bets_select_all" on public.darktable_bets for select
  to authenticated using (true);

drop policy if exists "darktable_bets_insert_own" on public.darktable_bets;
create policy "darktable_bets_insert_own" on public.darktable_bets for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "darktable_bets_update_own" on public.darktable_bets;
create policy "darktable_bets_update_own" on public.darktable_bets for update
  to authenticated using (user_id = auth.uid());

-- ============================================================================
-- Chat de la table — même forme que les autres salons.
-- ============================================================================
create table if not exists public.darktable_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.darktable_messages enable row level security;

drop policy if exists "darktable_messages_select_all" on public.darktable_messages;
create policy "darktable_messages_select_all" on public.darktable_messages for select
  to authenticated using (true);

drop policy if exists "darktable_messages_insert_self" on public.darktable_messages;
create policy "darktable_messages_insert_self" on public.darktable_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- Dettes de jeu — simple ardoise entre deux joueurs (aucun blocage de mise, purement indicatif).
-- Les crédits eux-mêmes sont déjà déplacés par send_gift() au moment du prêt ; cette table ne fait
-- que garder la trace de "qui doit combien à qui" pour l'afficher sur le profil/Amis.
-- ============================================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  note text,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  check (lender_id <> borrower_id)
);

alter table public.debts enable row level security;

drop policy if exists "debts_select_involved" on public.debts;
create policy "debts_select_involved" on public.debts for select
  to authenticated using (auth.uid() = lender_id or auth.uid() = borrower_id);

drop policy if exists "debts_insert_as_lender" on public.debts;
create policy "debts_insert_as_lender" on public.debts for insert
  to authenticated with check (lender_id = auth.uid());

-- Le prêteur ou l'emprunteur peut marquer l'ardoise comme soldée.
drop policy if exists "debts_settle_involved" on public.debts;
create policy "debts_settle_involved" on public.debts for update
  to authenticated using (auth.uid() = lender_id or auth.uid() = borrower_id);

-- ============================================================================
-- game_status row — maintenance + curseur "Probabilité de gain" (pilote le point de contrôle de
-- la manche, comme pour Crash).
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('darktable', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — manches, mises, chat et dettes en direct pour tout le monde concerné.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'darktable_rounds') then
    alter publication supabase_realtime add table public.darktable_rounds;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'darktable_bets') then
    alter publication supabase_realtime add table public.darktable_bets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'darktable_messages') then
    alter publication supabase_realtime add table public.darktable_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'debts') then
    alter publication supabase_realtime add table public.debts;
  end if;
end $$;
