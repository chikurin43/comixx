-- ComixX schema with profile/member/chat/poll enhancements
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_id text unique,
  display_name text,
  avatar_url text,
  bio text,
  notifications text default 'all' check (notifications in ('all', 'vote-only', 'none')),
  visibility text default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists public_id text;

create unique index if not exists profiles_public_id_unique on public.profiles (public_id) where public_id is not null;

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

create table if not exists public.palette_channels (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (palette_id, name)
);

create table if not exists public.palette_polls (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.palette_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.palette_polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  channel_id uuid references public.palette_channels(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists channel_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_channel_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_channel_id_fkey
      foreign key (channel_id) references public.palette_channels(id)
      on delete set null;
  end if;
end $$;

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
  poll_id uuid references public.palette_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  option_key text not null,
  created_at timestamptz not null default now(),
  unique (palette_id, user_id, topic)
);

alter table public.votes add column if not exists poll_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votes_poll_id_fkey'
  ) then
    alter table public.votes
      add constraint votes_poll_id_fkey
      foreign key (poll_id) references public.palette_polls(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists votes_poll_user_unique on public.votes (poll_id, user_id) where poll_id is not null;

create index if not exists messages_palette_created_idx on public.messages (palette_id, created_at);
create index if not exists messages_palette_channel_created_idx on public.messages (palette_id, channel_id, created_at);
create index if not exists members_palette_idx on public.palette_members (palette_id, joined_at);
create index if not exists reactions_palette_idx on public.message_reactions (palette_id, created_at);
create index if not exists channels_palette_idx on public.palette_channels (palette_id, created_at);
create index if not exists polls_palette_idx on public.palette_polls (palette_id, created_at);
create index if not exists poll_options_poll_idx on public.palette_poll_options (poll_id, sort_order);

alter table public.profiles enable row level security;
alter table public.palettes enable row level security;
alter table public.palette_members enable row level security;
alter table public.palette_channels enable row level security;
alter table public.palette_polls enable row level security;
alter table public.palette_poll_options enable row level security;
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

drop policy if exists "channels readable for public palettes" on public.palette_channels;
create policy "channels readable for public palettes"
  on public.palette_channels
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_channels.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "owner create channels" on public.palette_channels;
create policy "owner create channels"
  on public.palette_channels
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.palettes p
      where p.id = palette_channels.palette_id
        and p.owner_id = auth.uid()
    )
    and auth.uid() = created_by
  );

drop policy if exists "owner update channels" on public.palette_channels;
create policy "owner update channels"
  on public.palette_channels
  for update
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_channels.palette_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.palettes p
      where p.id = palette_channels.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "owner delete channels" on public.palette_channels;
create policy "owner delete channels"
  on public.palette_channels
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_channels.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "polls readable for public palettes" on public.palette_polls;
create policy "polls readable for public palettes"
  on public.palette_polls
  for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_polls.palette_id
        and p.is_public = true
    )
  );

drop policy if exists "owner create polls" on public.palette_polls;
create policy "owner create polls"
  on public.palette_polls
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.palettes p
      where p.id = palette_polls.palette_id
        and p.owner_id = auth.uid()
    )
    and auth.uid() = created_by
  );

drop policy if exists "owner update polls" on public.palette_polls;
create policy "owner update polls"
  on public.palette_polls
  for update
  to authenticated
  using (
    exists (
      select 1 from public.palettes p
      where p.id = palette_polls.palette_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.palettes p
      where p.id = palette_polls.palette_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "poll options readable" on public.palette_poll_options;
create policy "poll options readable"
  on public.palette_poll_options
  for select
  to authenticated, anon
  using (
    exists (
      select 1
      from public.palette_polls pp
      join public.palettes p on p.id = pp.palette_id
      where pp.id = palette_poll_options.poll_id
        and p.is_public = true
    )
  );

drop policy if exists "owner create poll options" on public.palette_poll_options;
create policy "owner create poll options"
  on public.palette_poll_options
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.palette_polls pp
      join public.palettes p on p.id = pp.palette_id
      where pp.id = palette_poll_options.poll_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "owner update poll options" on public.palette_poll_options;
create policy "owner update poll options"
  on public.palette_poll_options
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.palette_polls pp
      join public.palettes p on p.id = pp.palette_id
      where pp.id = palette_poll_options.poll_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.palette_polls pp
      join public.palettes p on p.id = pp.palette_id
      where pp.id = palette_poll_options.poll_id
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'palette_channels'
  ) then
    alter publication supabase_realtime add table public.palette_channels;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'palette_polls'
  ) then
    alter publication supabase_realtime add table public.palette_polls;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'palette_poll_options'
  ) then
    alter publication supabase_realtime add table public.palette_poll_options;
  end if;
end $$;

-- v2 chat schema extensions
alter table public.palette_members drop constraint if exists palette_members_role_check;
alter table public.palette_members
  add constraint palette_members_role_check check (role in ('owner', 'moderator', 'member'));

alter table public.palette_channels add column if not exists slug text;
update public.palette_channels
set slug = lower(regexp_replace(coalesce(name, 'channel'), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null or length(trim(slug)) = 0;

update public.palette_channels
set slug = concat('channel-', left(id::text, 8))
where slug in ('', '-') or slug is null;

create unique index if not exists channels_palette_slug_unique on public.palette_channels (palette_id, slug);

alter table public.messages add column if not exists parent_message_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists metadata jsonb default '{}'::jsonb;

update public.messages
set parent_message_id = reply_to_id
where parent_message_id is null and reply_to_id is not null;

create table if not exists public.message_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists message_moderation_logs_palette_idx
  on public.message_moderation_logs (palette_id, created_at desc);

alter table public.message_moderation_logs enable row level security;

drop policy if exists "moderation logs readable by owner and moderators" on public.message_moderation_logs;
create policy "moderation logs readable by owner and moderators"
  on public.message_moderation_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = message_moderation_logs.palette_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'moderator')
    )
  );

drop policy if exists "moderation logs insert by owner and moderators" on public.message_moderation_logs;
create policy "moderation logs insert by owner and moderators"
  on public.message_moderation_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = message_moderation_logs.palette_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'moderator')
    )
  );

drop policy if exists "author can update own messages" on public.messages;
create policy "author can update own messages"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner and moderator can update messages" on public.messages;
create policy "owner and moderator can update messages"
  on public.messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = messages.palette_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'moderator')
    )
  )
  with check (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = messages.palette_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'moderator')
    )
  );

-- v2 posts (manga drafts / diaries etc)

create table if not exists public.post_categories (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  name text not null,
  slug text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (palette_id, name),
  unique (palette_id, slug)
);

create table if not exists public.palette_posts (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  category_id uuid references public.post_categories(id) on delete set null,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.palette_posts(id) on delete cascade,
  sort_order integer not null default 0,
  r2_key text not null,
  content_type text not null,
  bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

create index if not exists post_categories_palette_idx on public.post_categories (palette_id, created_at desc);
create index if not exists palette_posts_palette_idx on public.palette_posts (palette_id, created_at desc);
create index if not exists post_images_post_idx on public.post_images (post_id, sort_order);

alter table public.post_categories enable row level security;
alter table public.palette_posts enable row level security;
alter table public.post_images enable row level security;

-- Read: palette members can view
drop policy if exists "post categories readable by palette members" on public.post_categories;
create policy "post categories readable by palette members"
  on public.post_categories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = post_categories.palette_id
        and pm.user_id = auth.uid()
    )
  );

drop policy if exists "posts readable by palette members" on public.palette_posts;
create policy "posts readable by palette members"
  on public.palette_posts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.palette_members pm
      where pm.palette_id = palette_posts.palette_id
        and pm.user_id = auth.uid()
    )
  );

drop policy if exists "post images readable by palette members" on public.post_images;
create policy "post images readable by palette members"
  on public.post_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.palette_members pm
      join public.palette_posts p on p.palette_id = pm.palette_id
      where pm.user_id = auth.uid()
        and p.id = post_images.post_id
    )
  );

-- Write: owner only (initial)
drop policy if exists "owner can create post categories" on public.post_categories;
create policy "owner can create post categories"
  on public.post_categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.palettes pal
      where pal.id = post_categories.palette_id
        and pal.owner_id = auth.uid()
    )
  );

drop policy if exists "owner can create posts" on public.palette_posts;
create policy "owner can create posts"
  on public.palette_posts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.palettes pal
      where pal.id = palette_posts.palette_id
        and pal.owner_id = auth.uid()
    )
  );

drop policy if exists "owner can update posts" on public.palette_posts;
create policy "owner can update posts"
  on public.palette_posts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.palettes pal
      where pal.id = palette_posts.palette_id
        and pal.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.palettes pal
      where pal.id = palette_posts.palette_id
        and pal.owner_id = auth.uid()
    )
  );

drop policy if exists "owner can create post images" on public.post_images;
create policy "owner can create post images"
  on public.post_images
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.palette_posts p
      join public.palettes pal on pal.id = p.palette_id
      where p.id = post_images.post_id
        and pal.owner_id = auth.uid()
    )
  );

-- Backfill default categories per palette (safe to run multiple times)
insert into public.post_categories (palette_id, name, slug, created_by)
select p.id, '日記', 'diary', p.owner_id
from public.palettes p
where not exists (
  select 1 from public.post_categories c where c.palette_id = p.id and c.slug = 'diary'
);

insert into public.post_categories (palette_id, name, slug, created_by)
select p.id, 'ラフ', 'rough', p.owner_id
from public.palettes p
where not exists (
  select 1 from public.post_categories c where c.palette_id = p.id and c.slug = 'rough'
);

insert into public.post_categories (palette_id, name, slug, created_by)
select p.id, '下書き', 'draft', p.owner_id
from public.palettes p
where not exists (
  select 1 from public.post_categories c where c.palette_id = p.id and c.slug = 'draft'
);

insert into public.post_categories (palette_id, name, slug, created_by)
select p.id, '線画', 'lineart', p.owner_id
from public.palettes p
where not exists (
  select 1 from public.post_categories c where c.palette_id = p.id and c.slug = 'lineart'
);

insert into public.post_categories (palette_id, name, slug, created_by)
select p.id, '完成版', 'final', p.owner_id
from public.palettes p
where not exists (
  select 1 from public.post_categories c where c.palette_id = p.id and c.slug = 'final'
);
