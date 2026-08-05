-- Ino Casino — "Parler avec les Dédé" chat at the Bar PMU. Run once in Supabase Dashboard →
-- SQL Editor (after schema.sql). Same shape as lobby_messages, just its own room.
create table public.pmu_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.pmu_messages enable row level security;

create policy "pmu_messages_select_all" on public.pmu_messages for select
  to authenticated using (true);

create policy "pmu_messages_insert_self" on public.pmu_messages for insert
  to authenticated with check (user_id = auth.uid());

alter publication supabase_realtime add table public.pmu_messages;
