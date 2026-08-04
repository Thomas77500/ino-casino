-- Ino Casino — social features schema (profiles, friendships, private salons + chat)
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run from scratch on a brand-new project.

-- ============================================================================
-- profiles
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  avatar text not null default '🎲',
  created_at timestamptz not null default now(),
  constraint profiles_username_lower_key unique (username_lower)
);

alter table public.profiles enable row level security;

-- Any signed-in user can look up any profile (needed for username search / friend requests).
-- Accepted tradeoff: this lets any account list the whole username directory — fine for a
-- casino side-feature, just not something to "fix" later without also changing the UX.
create policy "profiles_select_all" on public.profiles for select
  to authenticated using (true);

create policy "profiles_insert_self" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

create policy "profiles_update_self" on public.profiles for update
  to authenticated using (auth.uid() = id);

-- ============================================================================
-- friendships
-- ============================================================================
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  -- symmetric guard: (A,B) and (B,A) collapse to the same pair, so two people can't send
  -- simultaneous mutual requests and end up with duplicate/conflicting rows
  pair_key uuid[2] generated always as (array[least(requester, addressee), greatest(requester, addressee)]) stored,
  check (requester <> addressee)
);

create unique index friendships_pair_key_uniq on public.friendships (pair_key);

alter table public.friendships enable row level security;

create policy "friendships_select_own" on public.friendships for select
  to authenticated using (auth.uid() = requester or auth.uid() = addressee);

create policy "friendships_insert_as_requester" on public.friendships for insert
  to authenticated with check (auth.uid() = requester);

create policy "friendships_update_as_addressee" on public.friendships for update
  to authenticated using (auth.uid() = addressee) with check (auth.uid() = addressee);

create policy "friendships_delete_either_party" on public.friendships for delete
  to authenticated using (auth.uid() = requester or auth.uid() = addressee);

-- ============================================================================
-- private salons (rooms) + membership + chat
-- ============================================================================
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  owner uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.salon_members (
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create table public.salon_messages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.salon_messages enable row level security;

-- A policy on salon_members that subqueries salon_members itself causes Postgres to throw
-- "infinite recursion detected in policy" — this SECURITY DEFINER function is the real fix,
-- not a style choice. It bypasses RLS internally for one narrow, safe check.
create or replace function public.is_salon_member(p_salon_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = auth.uid()
  );
$$;
revoke all on function public.is_salon_member(uuid) from public;
grant execute on function public.is_salon_member(uuid) to authenticated;

-- No direct INSERT policy on salons/salon_members: creation and code-based joining go through
-- the two RPCs below, so the tables can never be broadly `select`-able by an arbitrary client
-- (which would otherwise let anyone enumerate every private salon's name/code).
create policy "salons_select_members" on public.salons for select
  to authenticated using (public.is_salon_member(id));

create policy "salons_delete_owner" on public.salons for delete
  to authenticated using (owner = auth.uid());

create policy "salon_members_select_fellow_members" on public.salon_members for select
  to authenticated using (public.is_salon_member(salon_id));

create policy "salon_members_delete_self" on public.salon_members for delete
  to authenticated using (user_id = auth.uid());

create policy "salon_messages_select_members" on public.salon_messages for select
  to authenticated using (public.is_salon_member(salon_id));

create policy "salon_messages_insert_members" on public.salon_messages for insert
  to authenticated with check (user_id = auth.uid() and public.is_salon_member(salon_id));

-- Creating a salon and joining one by code both need to write to salon_members from inside a
-- function the client doesn't otherwise have INSERT rights on — SECURITY DEFINER, explicitly
-- revoked from the default `public` role so only signed-in users can call them.
create or replace function public.create_salon(p_name text)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_salon public.salons;
begin
  -- 10 chars from a wide alphanumeric alphabet — a short hex code was brute-forceable in
  -- well under a day of requests; this isn't.
  v_code := upper(regexp_replace(encode(gen_random_bytes(8), 'base64'), '[^A-Za-z0-9]', '', 'g'));
  v_code := substr(v_code, 1, 10);

  insert into public.salons (name, code, owner) values (p_name, v_code, auth.uid())
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id) values (v_salon.id, auth.uid());

  return v_salon;
end;
$$;
revoke all on function public.create_salon(text) from public;
grant execute on function public.create_salon(text) to authenticated;

create or replace function public.join_salon_by_code(p_code text)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
begin
  select * into v_salon from public.salons where code = p_code;
  if v_salon.id is null then
    raise exception 'Salon introuvable';
  end if;

  insert into public.salon_members (salon_id, user_id)
  values (v_salon.id, auth.uid())
  on conflict do nothing;

  return v_salon;
end;
$$;
revoke all on function public.join_salon_by_code(text) from public;
grant execute on function public.join_salon_by_code(text) to authenticated;

-- ============================================================================
-- Realtime — live friend requests + live chat
-- ============================================================================
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.salon_messages;
