-- Ino Casino — progression/social batch #2 (titres, cadres, jackpot partagé, chat de lobby,
-- parrainage). Run this once in Supabase Dashboard → SQL Editor → New query → Run
-- (after schema.sql and schema_admin.sql).

-- ============================================================================
-- profiles — two new equippable cosmetics, same pattern as the existing `avatar` column
-- ============================================================================
alter table public.profiles add column if not exists frame text;
alter table public.profiles add column if not exists equipped_title text;

-- ============================================================================
-- lobby_messages — public chat, one room, no membership table needed
-- ============================================================================
create table public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.lobby_messages enable row level security;

create policy "lobby_messages_select_all" on public.lobby_messages for select
  to authenticated using (true);

create policy "lobby_messages_insert_self" on public.lobby_messages for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- jackpot — single shared row, grown by every bet across every game, won rarely
-- ============================================================================
create table public.jackpot (
  id text primary key,
  pot bigint not null default 1000,
  updated_at timestamptz not null default now()
);

alter table public.jackpot enable row level security;

create policy "jackpot_select_all" on public.jackpot for select
  to authenticated using (true);

-- Deliberately NO update policy: the only way to change `pot` is through the two
-- security-definer RPCs below, so a client can never write an arbitrary value directly.
insert into public.jackpot (id, pot) values ('main', 1000) on conflict (id) do nothing;

create or replace function public.increment_jackpot(p_amount int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jackpot
  set pot = pot + least(greatest(p_amount, 1), 50), updated_at = now()
  where id = 'main';
$$;
revoke all on function public.increment_jackpot(int) from public;
grant execute on function public.increment_jackpot(int) to authenticated;

-- `for update` locks the row for the duration of this function's transaction: if two players
-- hit the jackpot at nearly the same time, the second call blocks until the first commits (which
-- has already reset pot to 1000), so it reads the reset value and can't double-pay the same pot.
create or replace function public.claim_jackpot()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
begin
  select pot into v_amount from public.jackpot where id = 'main' for update;
  update public.jackpot set pot = 1000, updated_at = now() where id = 'main';
  return v_amount;
end;
$$;
revoke all on function public.claim_jackpot() from public;
grant execute on function public.claim_jackpot() to authenticated;

-- ============================================================================
-- referrals — invite bonus, credited locally on both sides (game economy stays local)
-- ============================================================================
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer uuid not null references public.profiles(id) on delete cascade,
  referred uuid not null unique references public.profiles(id) on delete cascade,
  reward_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  check (referrer <> referred)
);

alter table public.referrals enable row level security;

create policy "referrals_select_own" on public.referrals for select
  to authenticated using (auth.uid() = referrer or auth.uid() = referred);

-- The referrer claims (marks paid) their own pending rows the next time they're online —
-- see claim flow in App.tsx.
create policy "referrals_update_as_referrer" on public.referrals for update
  to authenticated using (auth.uid() = referrer) with check (auth.uid() = referrer);

create or replace function public.claim_referral(p_referrer_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
begin
  select id into v_referrer from public.profiles where username_lower = lower(p_referrer_username);
  if v_referrer is null or v_referrer = auth.uid() then
    return;
  end if;
  insert into public.referrals (referrer, referred) values (v_referrer, auth.uid())
  on conflict (referred) do nothing;
end;
$$;
revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- ============================================================================
-- Realtime — live jackpot counter + live public chat
-- ============================================================================
alter publication supabase_realtime add table public.jackpot;
alter publication supabase_realtime add table public.lobby_messages;
