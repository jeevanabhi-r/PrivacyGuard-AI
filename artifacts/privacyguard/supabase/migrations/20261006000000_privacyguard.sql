create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  reply_to uuid references public.messages (id) on delete cascade,
  check (
    (role = 'user' and reply_to is null)
    or (role = 'assistant' and reply_to is not null)
  ),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc, id asc);
create unique index if not exists messages_single_reply_idx
  on public.messages (reply_to)
  where reply_to is not null;

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('guide', 'checklist', 'lesson', 'quiz', 'recommendation')),
  completed_at timestamptz not null default now(),
  primary key (user_id, item_id, item_type)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.learning_progress enable row level security;

create policy "Users can read their own conversations"
  on public.conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can delete their own conversations"
  on public.conversations for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read their own messages"
  on public.messages for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

create policy "Users can add messages to their own conversations"
  on public.messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'user'
    and reply_to is null
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

create policy "Users can clear their own messages"
  on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read their own learning progress"
  on public.learning_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can record their own learning progress"
  on public.learning_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own learning progress"
  on public.learning_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can remove their own learning progress"
  on public.learning_progress for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.conversations to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant select, insert, update, delete on public.learning_progress to authenticated;

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_conversation_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.privacy_assistant_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, window_start)
);

alter table private.privacy_assistant_rate_limits enable row level security;
revoke all on private.privacy_assistant_rate_limits from public, anon, authenticated;

create or replace function public.consume_privacy_assistant_rate_limit(
  p_window_start timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if auth.uid() is null or p_window_start <> date_trunc('minute', now()) then
    return false;
  end if;

  delete from private.privacy_assistant_rate_limits
  where user_id = auth.uid()
    and window_start < p_window_start - interval '1 day';

  insert into private.privacy_assistant_rate_limits (user_id, window_start, request_count)
  values (auth.uid(), p_window_start, 1)
  on conflict (user_id, window_start)
  do update set request_count = private.privacy_assistant_rate_limits.request_count + 1
  returning request_count into current_count;

  return current_count <= 12;
end;
$$;

revoke all on function public.consume_privacy_assistant_rate_limit(timestamptz)
  from public, anon;
grant execute on function public.consume_privacy_assistant_rate_limit(timestamptz)
  to authenticated;
