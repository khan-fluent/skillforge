-- Seed data — only inserts if tables are empty. Safe to run on every boot.

INSERT INTO people (name, email, role, team, joined_at)
SELECT * FROM (VALUES
  ('Faisal Khan', 'faisal@khanfluent.digital', 'CEO / Principal SRE', 'Platform', DATE '2023-01-15'),
  ('Aisha Rahman', 'aisha@khanfluent.digital', 'Senior Backend Engineer', 'Platform', DATE '2023-04-02'),
  ('Diego Martinez', 'diego@khanfluent.digital', 'Cloud Engineer', 'Platform', DATE '2023-06-20'),
  ('Mei Lin', 'mei@khanfluent.digital', 'Data Engineer', 'Data', DATE '2024-01-10'),
  ('Jordan Parker', 'jordan@khanfluent.digital', 'Frontend Engineer', 'Product', DATE '2024-03-05'),
  ('Sam Okafor', 'sam@khanfluent.digital', 'DevOps Engineer', 'Platform', DATE '2024-08-12')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM people);

INSERT INTO skills (name, domain, description) VALUES
  ('PostgreSQL',     'databases', 'Relational database, SQL, indexing, replication'),
  ('MongoDB',        'databases', 'Document database, aggregation pipelines'),
  ('Redis',          'databases', 'In-memory key/value store, caching'),
  ('AWS',            'cloud',     'EC2, S3, IAM, VPC, RDS, ECS'),
  ('GCP',            'cloud',     'GKE, BigQuery, Cloud Run'),
  ('Cloudflare',     'cloud',     'CDN, Workers, DNS, Origin Rules'),
  ('Kubernetes',     'tools',     'Cluster ops, kubectl, Helm, operators'),
  ('Terraform',      'tools',     'IaC, modules, state management'),
  ('Docker',         'tools',     'Containers, multi-stage builds, compose'),
  ('Datadog',        'tools',     'APM, dashboards, monitors'),
  ('Go',             'languages', 'Concurrency, stdlib, microservices'),
  ('Python',         'languages', 'Scripting, data, FastAPI'),
  ('TypeScript',     'languages', 'Type system, Node, React'),
  ('React',          'languages', 'Hooks, state management, Vite'),
  ('GitHub Actions', 'tools',     'CI/CD, reusable workflows'),
  ('PagerDuty',      'tools',     'On-call, incident response')
ON CONFLICT (name) DO NOTHING;

-- Proficiencies: build a realistic, slightly-imbalanced matrix.
-- Using subqueries by name keeps this idempotent regardless of serial ids.
INSERT INTO proficiencies (person_id, skill_id, level, source)
SELECT p.id, s.id, v.level, 'seed'
FROM (VALUES
  ('Faisal Khan',     'AWS',            5),
  ('Faisal Khan',     'Terraform',      5),
  ('Faisal Khan',     'Kubernetes',     4),
  ('Faisal Khan',     'PostgreSQL',     4),
  ('Faisal Khan',     'GitHub Actions', 5),
  ('Faisal Khan',     'Cloudflare',     4),
  ('Faisal Khan',     'Go',             3),
  ('Aisha Rahman',    'PostgreSQL',     5),
  ('Aisha Rahman',    'Go',             5),
  ('Aisha Rahman',    'TypeScript',     4),
  ('Aisha Rahman',    'Redis',          4),
  ('Aisha Rahman',    'AWS',            3),
  ('Diego Martinez',  'AWS',            4),
  ('Diego Martinez',  'GCP',            3),
  ('Diego Martinez',  'Terraform',      3),
  ('Diego Martinez',  'Kubernetes',     3),
  ('Mei Lin',         'Python',         5),
  ('Mei Lin',         'PostgreSQL',     4),
  ('Mei Lin',         'MongoDB',        3),
  ('Jordan Parker',   'React',          5),
  ('Jordan Parker',   'TypeScript',     5),
  ('Jordan Parker',   'Python',         2),
  ('Sam Okafor',      'Docker',         5),
  ('Sam Okafor',      'Kubernetes',     4),
  ('Sam Okafor',      'Datadog',        4),
  ('Sam Okafor',      'GitHub Actions', 4),
  ('Sam Okafor',      'PagerDuty',      3)
) AS v(person_name, skill_name, level)
JOIN people p ON p.name = v.person_name
JOIN skills s ON s.name = v.skill_name
WHERE NOT EXISTS (
  SELECT 1 FROM proficiencies pr WHERE pr.person_id = p.id AND pr.skill_id = s.id
);

INSERT INTO certifications (person_id, name, issuer, issued_on, expires_on)
SELECT p.id, v.name, v.issuer, v.issued, v.expires
FROM (VALUES
  ('Faisal Khan',    'AWS Solutions Architect - Professional', 'AWS',         DATE '2024-03-10', DATE '2027-03-10'),
  ('Faisal Khan',    'HashiCorp Certified: Terraform Associate','HashiCorp',   DATE '2024-06-01', DATE '2026-06-01'),
  ('Sam Okafor',     'CKA: Certified Kubernetes Administrator', 'CNCF',        DATE '2025-01-15', DATE '2028-01-15'),
  ('Diego Martinez', 'AWS Solutions Architect - Associate',     'AWS',         DATE '2024-09-20', DATE '2027-09-20'),
  ('Aisha Rahman',   'AWS Developer - Associate',               'AWS',         DATE '2023-11-05', DATE '2026-11-05')
) AS v(person_name, name, issuer, issued, expires)
JOIN people p ON p.name = v.person_name
WHERE NOT EXISTS (
  SELECT 1 FROM certifications c WHERE c.person_id = p.id AND c.name = v.name
);
