-- ============================================================
-- Operation Red Trophy – TiDB / MySQL-compatible schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS operation_red_trophy;
USE operation_red_trophy;

-- -----------------------------------------------------------
-- teams
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  team_id       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  enabled       TINYINT(1)   NOT NULL DEFAULT 1,
  points        INT          NOT NULL DEFAULT 0,
  coins         INT          NOT NULL DEFAULT 25000,
  current_round INT          NOT NULL DEFAULT 0,
  is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
  status_flags  JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  active_effects JSON        NOT NULL DEFAULT (JSON_ARRAY()),
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_teams_points (points DESC),
  INDEX idx_teams_admin  (is_admin)
);

-- -----------------------------------------------------------
-- game_state  (per-team round progress)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_state (
  team_id              CHAR(36)     NOT NULL PRIMARY KEY,
  round_1_complete     TINYINT(1)   NOT NULL DEFAULT 0,
  round_2_complete     TINYINT(1)   NOT NULL DEFAULT 0,
  round_3_complete     TINYINT(1)   NOT NULL DEFAULT 0,
  final_complete       TINYINT(1)   NOT NULL DEFAULT 0,
  round3_answered_count INT         NOT NULL DEFAULT 0,
  round3_lat_progress  TEXT         NOT NULL DEFAULT (''),
  round3_lon_progress  TEXT         NOT NULL DEFAULT (''),
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_game_state_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- game_runtime  (singleton – global game state)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_runtime (
  id                        INT          NOT NULL PRIMARY KEY DEFAULT 1,
  status                    VARCHAR(20)  NOT NULL DEFAULT 'LIVE',
  active_round              VARCHAR(20)  NOT NULL DEFAULT 'INTRO',
  started_at                TIMESTAMP    NULL DEFAULT NULL,
  paused_at                 TIMESTAMP    NULL DEFAULT NULL,
  global_countdown_ends_at  TIMESTAMP    NULL DEFAULT NULL,
  round_timers              JSON         NOT NULL DEFAULT ('{"INTRO":180,"ROUND_1":900,"ROUND_2":900,"ROUND_3":1200,"FINAL":1800}'),
  round_timer_ends_at       JSON         NOT NULL DEFAULT ('{"INTRO":null,"ROUND_1":null,"ROUND_2":null,"ROUND_3":null,"FINAL":null}'),
  updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT chk_runtime_singleton CHECK (id = 1)
);

-- -----------------------------------------------------------
-- auction_runtime  (singleton – current auction state)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_runtime (
  id                         INT          NOT NULL PRIMARY KEY DEFAULT 1,
  active                     TINYINT(1)   NOT NULL DEFAULT 0,
  phase                      VARCHAR(20)  NOT NULL DEFAULT 'idle',
  winner_team_id             CHAR(36)     NULL DEFAULT NULL,
  winning_bid                INT          NULL DEFAULT NULL,
  drawn_card                 JSON         NULL DEFAULT NULL,
  target_team_id             CHAR(36)     NULL DEFAULT NULL,
  target_selection_deadline  TIMESTAMP    NULL DEFAULT NULL,
  created_at                 TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT chk_auction_singleton CHECK (id = 1),
  CONSTRAINT fk_auction_winner  FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_auction_target  FOREIGN KEY (target_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- auction_bids
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_bids (
  id         CHAR(36)   NOT NULL PRIMARY KEY,
  team_id    CHAR(36)   NOT NULL,
  amount     INT        NOT NULL,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_auction_bids_team (team_id),
  INDEX idx_auction_bids_amount (amount DESC, created_at ASC),

  CONSTRAINT chk_bid_positive CHECK (amount > 0),
  CONSTRAINT fk_auction_bids_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- auction_events
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_events (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  message    TEXT        NOT NULL,
  payload    JSON        NOT NULL DEFAULT (JSON_OBJECT()),
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_auction_events_created (created_at DESC)
);

-- -----------------------------------------------------------
-- active_effects
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS active_effects (
  id             CHAR(36)      NOT NULL PRIMARY KEY,
  team_id        CHAR(36)      NOT NULL,
  source_team_id CHAR(36)      NULL DEFAULT NULL,
  effect_type    VARCHAR(50)   NOT NULL,
  effect_value   DECIMAL(12,2) NULL DEFAULT NULL,
  source_card_id VARCHAR(50)   NULL DEFAULT NULL,
  metadata       JSON          NOT NULL DEFAULT (JSON_OBJECT()),
  expiry_time    TIMESTAMP     NULL DEFAULT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_effects_team (team_id, expiry_time),

  CONSTRAINT fk_effects_team   FOREIGN KEY (team_id)        REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_effects_source FOREIGN KEY (source_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- won_cards (Super Cards - cards won by teams in auctions)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS won_cards (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  team_id    CHAR(36)     NOT NULL,
  card_id    VARCHAR(50)  NOT NULL,
  card_name  VARCHAR(100) NOT NULL,
  card_data  JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  won_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_won_cards_team (team_id),
  INDEX idx_won_cards_created (won_at DESC),

  CONSTRAINT fk_won_cards_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
