-- Cloud sync for player progression (credits, level, XP, missions, history...) so it follows the
-- account across devices/browsers instead of staying local to one browser's storage.
create table if not exists public.casino_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.casino_progress enable row level security;

create policy "casino_progress_select_own" on public.casino_progress
  for select using (auth.uid() = user_id);

create policy "casino_progress_insert_own" on public.casino_progress
  for insert with check (auth.uid() = user_id);

create policy "casino_progress_update_own" on public.casino_progress
  for update using (auth.uid() = user_id);
