-- Ino Casino — admin win-probability control. Run once in Supabase Dashboard → SQL Editor
-- (after schema_admin.sql). Reuses the existing game_status table/RLS — no new policies needed,
-- the admin-only update policy already covers the whole row.
alter table public.game_status add column if not exists win_bias numeric not null default 1;

-- Also add the "boosters" game row if you hadn't already (from the TCG feature):
insert into public.game_status (id, enabled, message) values ('boosters', true, '')
on conflict (id) do nothing;
