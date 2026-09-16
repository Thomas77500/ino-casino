-- Ino Casino — Marché Noir (boutique + collection + échange entre joueurs + salon).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql, schema_progress.sql, schema_gifts.sql).
-- Idempotent end to end — safe to re-run in full if a previous attempt aborted partway.
-- 100% fictif : objets satiriques inventés (contrebande, dossiers, "outils" numériques qui
-- fonctionnent à moitié) — pas d'armes, pas d'organes, rien d'instructif sur un vrai délit.

-- ============================================================================
-- Inventaire — ce que chaque joueur possède. Mouvements en libre-service (ouvrir un lot dépense
-- ses propres crédits et ajoute à SA propre ligne) : même modèle de confiance que le reste du jeu
-- (aucun jeu de ce casino ne valide son RNG côté serveur). Seul l'achat entre joueurs (RPC
-- ci-dessous) touche le compte d'un AUTRE utilisateur, et passe donc par une fonction sécurisée.
-- ============================================================================
create table if not exists public.blackmarket_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  qty int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.blackmarket_inventory enable row level security;

drop policy if exists "blackmarket_inventory_select_own" on public.blackmarket_inventory;
create policy "blackmarket_inventory_select_own" on public.blackmarket_inventory for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "blackmarket_inventory_insert_own" on public.blackmarket_inventory;
create policy "blackmarket_inventory_insert_own" on public.blackmarket_inventory for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "blackmarket_inventory_update_own" on public.blackmarket_inventory;
create policy "blackmarket_inventory_update_own" on public.blackmarket_inventory for update
  to authenticated using (user_id = auth.uid());

-- ============================================================================
-- Annonces du marché — visibles par tous, mais seule la fonction buy_blackmarket_listing() peut
-- les faire passer à "sold" : aucune policy update pour les clients, donc impossible de trafiquer
-- le prix ou de se l'attribuer par une simple requête.
-- ============================================================================
create table if not exists public.blackmarket_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  item_label text not null,
  item_glyph text not null,
  item_rarity text not null,
  price bigint not null check (price > 0),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sold_at timestamptz
);

alter table public.blackmarket_listings enable row level security;

drop policy if exists "blackmarket_listings_select_all" on public.blackmarket_listings;
create policy "blackmarket_listings_select_all" on public.blackmarket_listings for select
  to authenticated using (true);

drop policy if exists "blackmarket_listings_insert_own" on public.blackmarket_listings;
create policy "blackmarket_listings_insert_own" on public.blackmarket_listings for insert
  to authenticated with check (seller_id = auth.uid());

-- Annuler sa propre annonce reste un self-update simple (aucun crédit ne bouge).
drop policy if exists "blackmarket_listings_cancel_own" on public.blackmarket_listings;
create policy "blackmarket_listings_cancel_own" on public.blackmarket_listings for update
  to authenticated using (seller_id = auth.uid() and status = 'active') with check (status = 'cancelled');

-- `for update` verrouille l'annonce et la ligne de crédits de l'acheteur pour la transaction, pour
-- qu'une double-vente ou un double-achat simultané soit impossible — même schéma que send_gift().
create or replace function public.buy_blackmarket_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
  v_item text;
  v_price bigint;
  v_buyer_credits numeric;
begin
  select seller_id, item_id, price into v_seller, v_item, v_price
  from public.blackmarket_listings
  where id = p_listing_id and status = 'active'
  for update;

  if v_seller is null then
    raise exception 'Cette annonce n''est plus disponible';
  end if;
  if v_seller = auth.uid() then
    raise exception 'Impossible d''acheter sa propre annonce';
  end if;

  select (state->>'credits')::numeric into v_buyer_credits
  from public.casino_progress where user_id = auth.uid() for update;

  if v_buyer_credits is null or v_buyer_credits < v_price then
    raise exception 'Crédits insuffisants';
  end if;

  update public.casino_progress
  set state = jsonb_set(state, '{credits}', to_jsonb(v_buyer_credits - v_price)), updated_at = now()
  where user_id = auth.uid();

  insert into public.casino_progress (user_id, state)
  values (v_seller, jsonb_build_object('credits', v_price))
  on conflict (user_id) do update
  set state = jsonb_set(
        public.casino_progress.state,
        '{credits}',
        to_jsonb(coalesce((public.casino_progress.state->>'credits')::numeric, 0) + v_price)
      ),
      updated_at = now();

  update public.blackmarket_listings
  set status = 'sold', buyer_id = auth.uid(), sold_at = now()
  where id = p_listing_id;

  insert into public.blackmarket_inventory (user_id, item_id, qty)
  values (auth.uid(), v_item, 1)
  on conflict (user_id, item_id) do update
  set qty = public.blackmarket_inventory.qty + 1, updated_at = now();
end;
$$;
revoke all on function public.buy_blackmarket_listing(uuid) from public;
grant execute on function public.buy_blackmarket_listing(uuid) to authenticated;

-- ============================================================================
-- Chat "Le Réseau" — même forme que salon_messages/ministry_messages/club_messages.
-- ============================================================================
create table if not exists public.blackmarket_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.blackmarket_messages enable row level security;

drop policy if exists "blackmarket_messages_select_all" on public.blackmarket_messages;
create policy "blackmarket_messages_select_all" on public.blackmarket_messages for select
  to authenticated using (true);

drop policy if exists "blackmarket_messages_insert_self" on public.blackmarket_messages;
create policy "blackmarket_messages_insert_self" on public.blackmarket_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- game_status row — maintenance + curseur "Probabilité de gain" (pilote la chance de tomber sur
-- un objet rare en ouvrant un lot).
-- ============================================================================
insert into public.game_status (id, enabled, message) values ('blackmarket', true, '')
on conflict (id) do nothing;

-- ============================================================================
-- Realtime — inventaire, annonces et chat en direct pour tout le monde.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blackmarket_inventory') then
    alter publication supabase_realtime add table public.blackmarket_inventory;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blackmarket_listings') then
    alter publication supabase_realtime add table public.blackmarket_listings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blackmarket_messages') then
    alter publication supabase_realtime add table public.blackmarket_messages;
  end if;
end $$;
