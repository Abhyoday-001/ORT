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

create index if not exists idx_game_runtime_status on public.game_runtime(status, active_round);

drop trigger if exists trg_game_runtime_updated_at on public.game_runtime;
create trigger trg_game_runtime_updated_at
before update on public.game_runtime
for each row execute function public.touch_updated_at();

alter table public.game_runtime enable row level security;

drop policy if exists "public game runtime read" on public.game_runtime;
create policy "public game runtime read"
on public.game_runtime
for select
using (true);
