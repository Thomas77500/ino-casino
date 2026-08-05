-- Ino Casino — fix: admin credit grants failed for players who never had a casino_progress row
-- yet (e.g. never logged in since cloud sync shipped) because the upsert hit the INSERT path,
-- and casino_progress only had an "insert own row" policy — an admin crediting someone else's
-- account isn't inserting their OWN row, so it was silently rejected by RLS.
-- Run once in Supabase Dashboard → SQL Editor (after schema_admin_users.sql).
create policy "casino_progress_insert_admin" on public.casino_progress for insert
  to authenticated with check (exists (select 1 from public.admins where user_id = auth.uid()));
