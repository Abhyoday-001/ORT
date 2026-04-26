alter table public.teams add column if not exists status_flags jsonb not null default '{}'::jsonb;
alter table public.teams add column if not exists active_effects jsonb not null default '[]'::jsonb;

create table if not exists public.auction_runtime (
  id integer primary key default 1 check (id = 1),
  active boolean not null default false,
  phase text not null default 'idle',
  winner_team_id uuid references public.teams(id) on delete set null,
  winning_bid integer,
  drawn_card jsonb,
  target_team_id uuid references public.teams(id) on delete set null,
  target_selection_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(team_id)
);

create table if not exists public.auction_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.active_effects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  source_team_id uuid references public.teams(id) on delete set null,
  effect_type text not null,
  effect_value numeric,
  source_card_id text,
  metadata jsonb not null default '{}'::jsonb,
  expiry_time timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auction_bids_amount on public.auction_bids(amount desc, created_at asc);
create index if not exists idx_auction_events_created_at on public.auction_events(created_at desc);
create index if not exists idx_active_effects_team on public.active_effects(team_id, expiry_time);

drop trigger if exists trg_auction_runtime_updated_at on public.auction_runtime;
create trigger trg_auction_runtime_updated_at
before update on public.auction_runtime
for each row execute function public.touch_updated_at();

alter table public.auction_runtime enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_events enable row level security;
alter table public.active_effects enable row level security;

drop policy if exists "public auction runtime read" on public.auction_runtime;
create policy "public auction runtime read"
on public.auction_runtime
for select
using (true);

drop policy if exists "public auction bids read" on public.auction_bids;
create policy "public auction bids read"
on public.auction_bids
for select
using (true);

drop policy if exists "public auction events read" on public.auction_events;
create policy "public auction events read"
on public.auction_events
for select
using (true);

drop policy if exists "public active effects read" on public.active_effects;
create policy "public active effects read"
on public.active_effects
for select
using (true);
