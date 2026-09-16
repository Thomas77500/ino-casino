-- Ino Casino — Blanchiment (cash-out en temps réel avant le contrôle fiscal).
-- Run once in Supabase Dashboard → SQL Editor (after schema.sql and schema_admin.sql).
-- Idempotent — safe to re-run. No dedicated tables: history/state stay local (casino_progress),
-- exactly like Crash — this only wires the maintenance toggle + "Probabilité de gain" admin slider.

insert into public.game_status (id, enabled, message) values ('laundering', true, '')
on conflict (id) do nothing;
