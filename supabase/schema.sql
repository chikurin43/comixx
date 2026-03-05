-- ComixX schema with profile/member/chat enhancements
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  notifications text default 'all' check (notifications in ('all', 'vote-only', 'none')),
  visibility text default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.palettes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.palette_members (
  palette_id uuid not null references public.palettes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (palette_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  option_key text not null,
  created_at timestamptz not null default now(),
  unique (palette_id, user_id, topic)
);

create index if not exists messages_palette_created_idx on public.messages (palette_id, created_at);
create index if not exists members_palette_idx on public.palette_members (palette_id, joined_at);
create index if not exists reactions_palette_idx on public.message_reactions (palette_id, created_at);

alter table public.profiles enable row level security;
alter table public.palettes enable row level security;
alter table public.palette_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.votes enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable"
  on public.profiles
  for select
  to authenticated, anon
  using (true);

drop policy if exists "profiles upsert self" on public.profiles;
create policy "profiles upsert self"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "palettes are readable when public" on public.palettes;
create policy "palettes are readable when public"
  on public.palettes
  for select
  to authenticated, anon
  using (is_public = true);

drop policy if exists "authenticated can create palettes" on public.palettes;
create policy "authenticated can create palettes"
  on public.palettes
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "owners can update palettes" on public.palettes;
create policy "owners can update palettes"
  on public.palettes
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "members readable" on public.palette_members;
create policy "members readable"
  on public.palette_members
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_members.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "members insert self" on public.palette_members;
create policy "members insert self"
  on public.palette_members
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owner manage members" on public.palette_members;
create policy "owner manage members"
  on public.palette_members
  for update
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_members.palette_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.palettes p
      where p.id = palette_members.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "owner delete members" on public.palette_members;
create policy "owner delete members"
  on public.palette_members
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_members.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "messages readable for public palettes" on public.messages;
create policy "messages readable for public palettes"
  on public.messages
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = messages.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "authenticated can post own messages" on public.messages;
create policy "authenticated can post own messages"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "author can delete own messages" on public.messages;
create policy "author can delete own messages"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owner can delete any message" on public.messages;
create policy "owner can delete any message"
  on public.messages
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = messages.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "reactions readable" on public.message_reactions;
create policy "reactions readable"
  on public.message_reactions
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = message_reactions.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "reactions insert self" on public.message_reactions;
create policy "reactions insert self"
  on public.message_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reactions delete self" on public.message_reactions;
create policy "reactions delete self"
  on public.message_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "votes readable for public palettes" on public.votes;
create policy "votes readable for public palettes"
  on public.votes
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = votes.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "authenticated can upsert own votes" on public.votes;
create policy "authenticated can upsert own votes"
  on public.votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "authenticated can update own votes" on public.votes;
create policy "authenticated can update own votes"
  on public.votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_profile_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
before update on public.profiles
for each row
execute function public.set_profile_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'votes'
  ) then
    alter publication supabase_realtime add table public.votes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
