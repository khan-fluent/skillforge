-- Skillforge schema. Idempotent — safe to run on every boot.

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) UNIQUE,
  role VARCHAR(200),
  team VARCHAR(200),
  avatar_url VARCHAR(1024),
  joined_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  domain VARCHAR(100) NOT NULL,            -- e.g. databases, cloud, languages, tools
  description TEXT,
  deprecated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proficiency: 1=novice, 2=advanced beginner, 3=competent, 4=proficient, 5=expert
CREATE TABLE IF NOT EXISTS proficiencies (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  source VARCHAR(50) DEFAULT 'self',       -- self, lead, inferred
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, skill_id)
);

CREATE TABLE IF NOT EXISTS certifications (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  issuer VARCHAR(200),
  issued_on DATE,
  expires_on DATE,
  credential_url VARCHAR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proficiencies_person ON proficiencies(person_id);
CREATE INDEX IF NOT EXISTS idx_proficiencies_skill ON proficiencies(skill_id);
CREATE INDEX IF NOT EXISTS idx_certifications_person ON certifications(person_id);
CREATE INDEX IF NOT EXISTS idx_skills_domain ON skills(domain);
