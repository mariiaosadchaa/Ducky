-- Ducky: дані користувача. Виконайте в Supabase: SQL Editor → New query → Run.
-- Таблиця окрема (префікс ducky_), тож не зачіпає таблиці Rivna app.
create table if not exists public.ducky_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ducky_data enable row level security;

drop policy if exists "ducky_select_own" on public.ducky_data;
create policy "ducky_select_own" on public.ducky_data
  for select using ((select auth.uid()) = user_id);
drop policy if exists "ducky_insert_own" on public.ducky_data;
create policy "ducky_insert_own" on public.ducky_data
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "ducky_update_own" on public.ducky_data;
create policy "ducky_update_own" on public.ducky_data
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ducky_delete_own" on public.ducky_data;
create policy "ducky_delete_own" on public.ducky_data
  for delete using ((select auth.uid()) = user_id);

-- ============================================================
-- Спільна (сімейна) комора: одна на домогосподарство з Rivna app
-- Запустіть у Supabase → SQL Editor. Безпечно запускати повторно.
-- ============================================================
create table if not exists public.ducky_household_data (
  household_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.ducky_household_data enable row level security;

drop policy if exists "ducky household read" on public.ducky_household_data;
create policy "ducky household read" on public.ducky_household_data
  for select using (exists (select 1 from public.household_members m
    where m.household_id = ducky_household_data.household_id and m.user_id = auth.uid()));

drop policy if exists "ducky household insert" on public.ducky_household_data;
create policy "ducky household insert" on public.ducky_household_data
  for insert with check (exists (select 1 from public.household_members m
    where m.household_id = ducky_household_data.household_id and m.user_id = auth.uid()));

drop policy if exists "ducky household update" on public.ducky_household_data;
create policy "ducky household update" on public.ducky_household_data
  for update using (exists (select 1 from public.household_members m
    where m.household_id = ducky_household_data.household_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.household_members m
    where m.household_id = ducky_household_data.household_id and m.user_id = auth.uid()));

-- живе оновлення між учасниками (realtime)
do $$ begin
  alter publication supabase_realtime add table public.ducky_household_data;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Сповіщення «Дім» (коли застосунок закритий). Безпечно запускати повторно.
-- Політик немає навмисно: таблиця доступна лише серверу (сервісний ключ).
-- ============================================================
create table if not exists public.ducky_push (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  sub jsonb not null,
  items jsonb not null default '[]'::jsonb,
  sent jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ducky_push enable row level security;
