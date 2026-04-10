-- Skillforge schema. Multi-tenant: every domain row scopes to a team.
-- Idempotent. Safe to run on every boot. Uses CREATE TABLE IF NOT EXISTS
-- so existing data is never touched.

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
  description     TEXT,
  status          VARCHAR(80),
  assignee_email  VARCHAR(320),
  assignee_name   VARCHAR(200),
  story_points    NUMERIC(6,2),
  sprint          VARCHAR(200),
  project_key     VARCHAR(50),
  project_name    VARCHAR(200),
  resolved_at     TIMESTAMPTZ,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  raw             JSONB,
  UNIQUE(team_id, jira_key, snapshot_date)
);

-- Upgrades for existing deployments — Postgres ignores IF NOT EXISTS adds.
ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS project_key  VARCHAR(50);
ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS project_name VARCHAR(200);

-- Chat session history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(300),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- SSO support: link external identity to local user
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject  VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_jira_issues_team_date ON jira_issues(team_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_jira_issues_assignee  ON jira_issues(team_id, assignee_email);

-- Knowledge base
CREATE TABLE IF NOT EXISTS kb_folders (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES kb_folders(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  folder_id   INTEGER REFERENCES kb_folders(id) ON DELETE SET NULL,
  title       VARCHAR(500) NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_document_skills (
  document_id INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  skill_id    INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_folders_team     ON kb_folders(team_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_team   ON kb_documents(team_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_folder ON kb_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_kb_doc_skills_skill ON kb_document_skills(skill_id);

-- Business domains: products, business units, internal systems, etc.
-- Same proficiency model as skills (1-5 scale) for org-level knowledge mapping.
CREATE TABLE IF NOT EXISTS domains (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  category    VARCHAR(100) NOT NULL DEFAULT 'general',
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, name)
);

CREATE TABLE IF NOT EXISTS domain_proficiencies (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id   INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  notes       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_domains_team              ON domains(team_id);
CREATE INDEX IF NOT EXISTS idx_domain_proficiencies_user ON domain_proficiencies(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_proficiencies_dom  ON domain_proficiencies(domain_id);

CREATE INDEX IF NOT EXISTS idx_users_team           ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_token   ON users(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skills_team          ON skills(team_id);
CREATE INDEX IF NOT EXISTS idx_proficiencies_user   ON proficiencies(user_id);
CREATE INDEX IF NOT EXISTS idx_proficiencies_skill  ON proficiencies(skill_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user  ON certifications(user_id);
