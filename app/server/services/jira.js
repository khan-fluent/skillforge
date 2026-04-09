// Jira data layer. Two backends behind one interface so we can flip from
// mock → live with a single env var (or per-team `is_mock` flag) once a
// real Jira Cloud connection exists.
//
// Live backend: GET https://<host>/rest/api/3/search/jql
//   Auth: HTTP Basic with email + API token, base64-encoded.
//
// Mock backend: deterministic synthetic data, seeded from team members so
// the names match what's already in the workspace.

import { query } from "../db/index.js";

const STATUSES = ["To Do", "In Progress", "In Review", "Done", "Done", "Done"]; // weighted toward done
const SPRINTS  = ["Sprint 41", "Sprint 42", "Sprint 43"];
const VERBS    = ["Fix", "Refactor", "Investigate", "Add", "Remove", "Migrate", "Document", "Optimize"];
const NOUNS    = ["auth flow", "rate limiter", "audit log", "DB pool", "checkout webhook", "search index", "feature flag", "metrics pipeline", "image cache", "RBAC policy"];

// Hash a string to a stable number — used to make mock data consistent
// for the same team between reloads (so the dashboard doesn't reshuffle
// every refresh).
function seedFrom(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function rng(seed) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

export async function generateMockIssues(teamId, count = 40) {
  const { rows: members } = await query(
    "SELECT name, email FROM users WHERE team_id = $1 ORDER BY id",
    [teamId]
  );
  if (!members.length) return [];

  const r = rng(seedFrom(`team-${teamId}`));
  const issues = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const m = members[Math.floor(r() * members.length)];
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    const isDone = status === "Done";
    const daysAgo = Math.floor(r() * 56); // last 8 weeks
    const points = [1, 2, 2, 3, 3, 5, 5, 8, 13][Math.floor(r() * 9)];
    issues.push({
      jira_key:      `SKL-${1000 + i}`,
      summary:       `${VERBS[Math.floor(r() * VERBS.length)]} ${NOUNS[Math.floor(r() * NOUNS.length)]}`,
      status,
      assignee_email: m.email,
      assignee_name:  m.name,
      story_points:  points,
      sprint:        SPRINTS[Math.floor(r() * SPRINTS.length)],
      resolved_at:   isDone ? new Date(now - daysAgo * 86400000).toISOString() : null,
    });
  }
  return issues;
}

// Live Jira Cloud search. Not exercised yet — kept here so the swap is
// truly one line in `searchIssues` below.
async function liveSearch(connection, jql, max = 100) {
  const auth = Buffer.from(`${connection.email}:${connection.api_token}`).toString("base64");
  const url = `${connection.base_url.replace(/\/$/, "")}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${max}&fields=summary,status,assignee,customfield_10016,sprint,resolutiondate`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return (body.issues || []).map((i) => ({
    jira_key:       i.key,
    summary:        i.fields.summary,
    status:         i.fields.status?.name,
    assignee_email: i.fields.assignee?.emailAddress || null,
    assignee_name:  i.fields.assignee?.displayName  || null,
    story_points:   i.fields.customfield_10016 || null,
    sprint:         i.fields.sprint?.[0]?.name || null,
    resolved_at:    i.fields.resolutiondate || null,
  }));
}

// Single entry point. Routes call this; they don't care which backend runs.
export async function searchIssues({ teamId, connection, jql }) {
  if (!connection || connection.is_mock) {
    return generateMockIssues(teamId, 50);
  }
  return liveSearch(connection, jql || "ORDER BY updated DESC");
}

// Persist a fresh snapshot of issues for a team. Idempotent per
// (team, key, date) — re-running the same day overwrites.
export async function snapshotIssues(teamId, filterId, issues) {
  for (const i of issues) {
    await query(
      `INSERT INTO jira_issues (team_id, filter_id, jira_key, summary, status, assignee_email, assignee_name, story_points, sprint, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (team_id, jira_key, snapshot_date)
       DO UPDATE SET status = EXCLUDED.status,
                     assignee_email = EXCLUDED.assignee_email,
                     assignee_name = EXCLUDED.assignee_name,
                     story_points = EXCLUDED.story_points,
                     sprint = EXCLUDED.sprint,
                     resolved_at = EXCLUDED.resolved_at,
                     filter_id = EXCLUDED.filter_id`,
      [
        teamId, filterId, i.jira_key, i.summary, i.status, i.assignee_email,
        i.assignee_name, i.story_points, i.sprint, i.resolved_at,
      ]
    );
  }
}
