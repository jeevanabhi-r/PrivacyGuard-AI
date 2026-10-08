-- Migration: 20261008000000_privacy_actions.sql
-- Create table for user-created and saved privacy actions with RLS

create table if not exists public.privacy_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  category text not null check (category in (
    'Account Security',
    'Social Media Privacy',
    'Location Privacy',
    'App Permissions',
    'Browser Safety',
    'Other'
  )),
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_actions_user_created_idx
  on public.privacy_actions (user_id, created_at desc);

create index if not exists privacy_actions_user_completed_idx
  on public.privacy_actions (user_id, completed);

alter table public.privacy_actions enable row level security;

create policy "Users can read their own privacy actions"
  on public.privacy_actions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their own privacy actions"
  on public.privacy_actions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own privacy actions"
  on public.privacy_actions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own privacy actions"
  on public.privacy_actions for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.privacy_actions to authenticated;

create or replace function public.touch_privacy_action_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger privacy_actions_touch_updated_at
  before update on public.privacy_actions
  for each row execute function public.touch_privacy_action_updated_at();
