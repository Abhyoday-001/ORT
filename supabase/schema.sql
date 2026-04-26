-- Enable uuid generation
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  team_id text unique not null,
  password_hash text not null,
  enabled boolean not null default true,
  points integer not null default 0,
  current_round integer not null default 0,
  is_admin boolean not null default false,
  status_flags jsonb not null default '{}'::jsonb,
  active_effects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams add column if not exists enabled boolean not null default true;
alter table public.teams add column if not exists status_flags jsonb not null default '{}'::jsonb;
alter table public.teams add column if not exists active_effects jsonb not null default '[]'::jsonb;

create table if not exists public.game_state (
  team_id uuid primary key references public.teams(id) on delete cascade,
  round_1_complete boolean not null default false,
  round_2_complete boolean not null default false,
  round_3_complete boolean not null default false,
  final_complete boolean not null default false,
  round3_answered_count integer not null default 0,
  round3_lat_progress text not null default '',
  round3_lon_progress text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.game_runtime (
  id integer primary key default 1 check (id = 1),
  status text not null default 'LIVE',
  active_round text not null default 'INTRO',
  started_at timestamptz,
  paused_at timestamptz,
  global_countdown_ends_at timestamptz,
  round_timers jsonb not null default '{"INTRO":180,"ROUND_1":900,"ROUND_2":900,"ROUND_3":1200,"FINAL":1800}'::jsonb,
  round_timer_ends_at jsonb not null default '{"INTRO":null,"ROUND_1":null,"ROUND_2":null,"ROUND_3":null,"FINAL":null}'::jsonb,
  updated_at timestamptz not null default now()
);

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

create index if not exists idx_teams_points on public.teams(points desc);
create index if not exists idx_teams_admin on public.teams(is_admin);
create index if not exists idx_game_runtime_status on public.game_runtime(status, active_round);
create index if not exists idx_auction_bids_amount on public.auction_bids(amount desc, created_at asc);
create index if not exists idx_auction_events_created_at on public.auction_events(created_at desc);
create index if not exists idx_active_effects_team on public.active_effects(team_id, expiry_time);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.touch_updated_at();

drop trigger if exists trg_game_state_updated_at on public.game_state;
create trigger trg_game_state_updated_at
before update on public.game_state
for each row execute function public.touch_updated_at();

drop trigger if exists trg_game_runtime_updated_at on public.game_runtime;
create trigger trg_game_runtime_updated_at
before update on public.game_runtime
for each row execute function public.touch_updated_at();

drop trigger if exists trg_auction_runtime_updated_at on public.auction_runtime;
create trigger trg_auction_runtime_updated_at
before update on public.auction_runtime
for each row execute function public.touch_updated_at();

alter table public.teams enable row level security;
alter table public.game_state enable row level security;
alter table public.game_runtime enable row level security;
alter table public.auction_runtime enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_events enable row level security;
alter table public.active_effects enable row level security;

-- Public leaderboard: no admin rows exposed
drop policy if exists "public leaderboard read" on public.teams;
create policy "public leaderboard read"
on public.teams
for select
using (is_admin = false);

drop policy if exists "public game runtime read" on public.game_runtime;
create policy "public game runtime read"
on public.game_runtime
for select
using (true);

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

-- Service-role backend will bypass RLS using service key.
