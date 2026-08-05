-- Ino Casino — credit gifting between players. Run once in Supabase Dashboard → SQL Editor
-- (after schema.sql and schema_progress.sql).

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);

alter table public.gifts enable row level security;

create policy "gifts_select_own" on public.gifts for select
  to authenticated using (auth.uid() = sender or auth.uid() = recipient);

-- No insert policy at all — the only way to create a row is through send_gift() below, so a
-- client can never log a gift without the matching credit transfer actually happening.

-- `for update` locks the sender's casino_progress row for the transaction so two simultaneous
-- gifts from the same account can't both read the same balance and double-spend it.
create or replace function public.send_gift(p_to uuid, p_amount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_credits numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_to = auth.uid() then
    raise exception 'Impossible de se faire un don à soi-même';
  end if;

  select (state->>'credits')::numeric into v_sender_credits
  from public.casino_progress where user_id = auth.uid() for update;

  if v_sender_credits is null or v_sender_credits < p_amount then
    raise exception 'Crédits insuffisants';
  end if;

  update public.casino_progress
  set state = jsonb_set(state, '{credits}', to_jsonb(v_sender_credits - p_amount)), updated_at = now()
  where user_id = auth.uid();

  insert into public.casino_progress (user_id, state)
  values (p_to, jsonb_build_object('credits', p_amount))
  on conflict (user_id) do update
  set state = jsonb_set(
        public.casino_progress.state,
        '{credits}',
        to_jsonb(coalesce((public.casino_progress.state->>'credits')::numeric, 0) + p_amount)
      ),
      updated_at = now();

  insert into public.gifts (sender, recipient, amount) values (auth.uid(), p_to, p_amount);
end;
$$;
revoke all on function public.send_gift(uuid, bigint) from public;
grant execute on function public.send_gift(uuid, bigint) to authenticated;

-- Realtime — the recipient gets a live toast + credit bump the instant a gift lands.
alter publication supabase_realtime add table public.gifts;
