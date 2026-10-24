-- Ducky: швидкі команди iPhone. Supabase → SQL Editor → New query → вставити все → Run.
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
