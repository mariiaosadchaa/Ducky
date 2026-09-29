-- Ducky: дані користувача. Виконайте в Supabase: SQL Editor → New query → Run.
-- Таблиця окрема (префікс ducky_), тож не зачіпає таблиці Rivna app.
create table if not exists public.ducky_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ducky_data enable row level security;

create policy "ducky_select_own" on public.ducky_data
  for select using ((select auth.uid()) = user_id);
create policy "ducky_insert_own" on public.ducky_data
  for insert with check ((select auth.uid()) = user_id);
create policy "ducky_update_own" on public.ducky_data
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ducky_delete_own" on public.ducky_data
  for delete using ((select auth.uid()) = user_id);
