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

-- ============================================================
-- Швидкі команди iPhone (Команди/Shortcuts → черга → Ducky). Безпечно запускати повторно.
-- Команда з телефона кладе текст у чергу за особистим ключем; застосунок показує його
-- в коморі, ШІ пропонує зміни, і вони застосовуються лише після підтвердження.
-- ============================================================
create table if not exists public.ducky_inbox_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ducky_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 2 and 500),
  created_at timestamptz not null default now()
);
alter table public.ducky_inbox_keys enable row level security;
alter table public.ducky_inbox enable row level security;

drop policy if exists "ducky_keys_select" on public.ducky_inbox_keys;
create policy "ducky_keys_select" on public.ducky_inbox_keys for select using ((select auth.uid()) = user_id);
drop policy if exists "ducky_keys_insert" on public.ducky_inbox_keys;
create policy "ducky_keys_insert" on public.ducky_inbox_keys for insert with check ((select auth.uid()) = user_id);
drop policy if exists "ducky_keys_update" on public.ducky_inbox_keys;
create policy "ducky_keys_update" on public.ducky_inbox_keys for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ducky_inbox_select" on public.ducky_inbox;
create policy "ducky_inbox_select" on public.ducky_inbox for select using ((select auth.uid()) = user_id);
drop policy if exists "ducky_inbox_delete" on public.ducky_inbox;
create policy "ducky_inbox_delete" on public.ducky_inbox for delete using ((select auth.uid()) = user_id);

create or replace function public.ducky_inbox_add(p_key text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from public.ducky_inbox_keys where key = p_key;
  if uid is null then raise exception 'Невірний ключ'; end if;
  if char_length(coalesce(p_text, '')) < 2 then raise exception 'Порожній текст'; end if;
  if (select count(*) from public.ducky_inbox where user_id = uid) >= 50 then raise exception 'Черга заповнена'; end if;
  insert into public.ducky_inbox (user_id, text) values (uid, left(p_text, 500));
end $$;
revoke all on function public.ducky_inbox_add(text, text) from public;
grant execute on function public.ducky_inbox_add(text, text) to anon, authenticated;
