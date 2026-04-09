-- Skillforge schema. Multi-tenant: every domain row scopes to a team.
-- Idempotent. Safe to run on every boot.
--
-- v1 → v2 migration: drops the old single-tenant `people` table and its
-- children. There were no real tenants on v1 (only seed data), so a
-- destructive drop is fine.

DROP TABLE IF EXISTS proficiencies CASCADE;
DROP TABLE IF EXISTS certifications CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS people CASCADE;

CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role          VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  job_title     VARCHAR(200),
  invite_token  VARCHAR(64),
  invited_at    TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  domain      VARCHAR(100) NOT NULL,
  description TEXT,
  deprecated  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, name)
);

-- Proficiency: 1=novice, 2=advanced beginner, 3=competent, 4=proficient, 5=expert
CREATE TABLE IF NOT EXISTS proficiencies (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id    INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  source      VARCHAR(50) DEFAULT 'self',
  notes       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS certifications (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(200) NOT NULL,
  issuer         VARCHAR(200),
  issued_on      DATE,
  expires_on     DATE,
  credential_url VARCHAR(1024),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_connections (
  id           SERIAL PRIMARY KEY,
  team_id      INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  base_url     VARCHAR(500) NOT NULL,
  email        VARCHAR(320) NOT NULL,
  api_token    VARCHAR(500) NOT NULL,
  is_mock      BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_filters (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  jql         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_issues (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  filter_id       INTEGER REFERENCES jira_filters(id) ON DELETE SET NULL,
  jira_key        VARCHAR(50) NOT NULL,
  summary         TEXT,
  status          VARCHAR(80),
  assignee_email  VARCHAR(320),
  assignee_name   VARCHAR(200),
  story_points    NUMERIC(6,2),
  sprint          VARCHAR(200),
  resolved_at     TIMESTAMPTZ,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  raw             JSONB,
  UNIQUE(team_id, jira_key, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_jira_issues_team_date ON jira_issues(team_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_jira_issues_assignee  ON jira_issues(team_id, assignee_email);

CREATE INDEX IF NOT EXISTS idx_users_team           ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_token   ON users(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skills_team          ON skills(team_id);
CREATE INDEX IF NOT EXISTS idx_proficiencies_user   ON proficiencies(user_id);
CREATE INDEX IF NOT EXISTS idx_proficiencies_skill  ON proficiencies(skill_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user  ON certifications(user_id);
