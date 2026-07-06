-- STRIDE cloud sync schema (Supabase / Postgres).
-- Run this once in the Supabase SQL Editor (Dashboard → SQL → New query).
--
-- Model: each row stores the app record as a JSONB `data` blob plus an
-- `updated_at` epoch-ms bigint used for last-write-wins sync. Row Level
-- Security scopes every row to its owner (auth.uid()). Deletions propagate via
-- a tombstone table so removals reach other devices.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null
);

create table if not exists public.workouts (
  id         text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

create table if not exists public.programs (
  id         text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

create table if not exists public.custom_exercises (
  id         text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

-- Tombstones for deleted records (so deletions sync across devices).
create table if not exists public.deletions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  entity     text not null check (entity in ('workouts', 'programs', 'custom_exercises')),
  entity_id  text not null,
  deleted_at bigint not null,
  primary key (user_id, entity, entity_id)
);

create index if not exists workouts_updated_idx on public.workouts (user_id, updated_at);
create index if not exists programs_updated_idx on public.programs (user_id, updated_at);
create index if not exists custom_exercises_updated_idx on public.custom_exercises (user_id, updated_at);
create index if not exists deletions_updated_idx on public.deletions (user_id, deleted_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — each user can only see and write their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.workouts         enable row level security;
alter table public.programs         enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.deletions        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','workouts','programs','custom_exercises','deletions']
  loop
    execute format('drop policy if exists %I_owner on public.%I;', t, t);
    execute format(
      'create policy %I_owner on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — broadcast row changes so other devices update live.
-- ---------------------------------------------------------------------------

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.workouts';         exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.programs';         exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.custom_exercises'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.profiles';         exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.deletions';        exception when duplicate_object then null; end;
end $$;
