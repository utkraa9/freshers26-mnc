-- Freshers'26 organizer expenses
-- Run once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  expense text not null,
  category text not null default 'Other',
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

grant select, insert on public.expenses to authenticated;

drop policy if exists "organizers can read expenses" on public.expenses;
drop policy if exists "organizers can insert expenses" on public.expenses;

create policy "organizers can read expenses"
on public.expenses
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
      and p.role in ('organizer','admin')
  )
);

create policy "organizers can insert expenses"
on public.expenses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
      and p.role in ('organizer','admin')
  )
);

create index if not exists expenses_date_created_idx
on public.expenses (date desc, created_at desc);
