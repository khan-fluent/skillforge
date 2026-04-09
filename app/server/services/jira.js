// Jira data layer. Two backends behind one interface so connecting a real
// Jira Cloud workspace is a config flip — `is_mock=false` on the team's
// jira_connections row — and nothing in routes or UI changes.
//
// Live backend: GET https://<host>/rest/api/3/search/jql
//   Auth: HTTP Basic with email + API token, base64-encoded.
//   Story points field: customfield_10016 by default (Jira Cloud standard);
//   override per deployment with SKILLFORGE_JIRA_POINTS_FIELD env var.

import { query } from "../db/index.js";

// ─────────────── Mock backend ───────────────

const STATUSES = ["To Do", "In Progress", "In Review", "Done", "Done", "Done"];
const SPRINTS  = ["Sprint 41", "Sprint 42", "Sprint 43"];
const VERBS    = ["Fix", "Refactor", "Investigate", "Add", "Remove", "Migrate", "Document", "Optimize"];
const NOUNS    = ["auth flow", "rate limiter", "audit log", "DB pool", "checkout webhook", "search index", "feature flag", "metrics pipeline", "image cache", "RBAC policy"];

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

export async function generateMockIssues(teamId, count = 50) {
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
    const daysAgo = Math.floor(r() * 56);
    const points = [1, 2, 2, 3, 3, 5, 5, 8, 13][Math.floor(r() * 9)];
    const verb = VERBS[Math.floor(r() * VERBS.length)];
    const noun = NOUNS[Math.floor(r() * NOUNS.length)];
    issues.push({
      jira_key:       `MOCK-${1000 + i}`,
      summary:        `${verb} ${noun}`,
      description:    `${verb} the ${noun} so it stops paging us at 3am. Includes a small refactor and a regression test.`,
      status,
      assignee_email: m.email,
      assignee_name:  m.name,
      story_points:   points,
      sprint:         SPRINTS[Math.floor(r() * SPRINTS.length)],
      project_key:    "MOCK",
      project_name:   "Demo Project",
      resolved_at:    isDone ? new Date(now - daysAgo * 86400000).toISOString() : null,
    });
  }
  return issues;
}

// ─────────────── Live backend ───────────────

const POINTS_FIELD = process.env.SKILLFORGE_JIRA_POINTS_FIELD || "customfield_10016";
const SPRINT_FIELD = "customfield_10020";

// Walk Jira's Atlassian Document Format (returned for description fields on
// the v3 API) and pull out the plain text. We don't render rich content; we
// just want a one-paragraph summary.
function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");
  if (node.text) return node.text;
  if (node.content) return node.content.map(adfToText).join(node.type === "paragraph" ? "\n" : "");
  return "";
}

async function liveSearch(connection, jql) {
  const auth = Buffer.from(`${connection.email}:${connection.api_token}`).toString("base64");
  const fields = ["summary", "description", "status", "assignee", "resolutiondate", "project", POINTS_FIELD, SPRINT_FIELD].join(",");
  const base = connection.base_url.replace(/\/$/, "");

  const out = [];
  let nextPageToken = null;
  let safety = 0; // hard cap on pagination loops

  do {
    const url = new URL(`${base}/rest/api/3/search/jql`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("fields", fields);
    url.searchParams.set("maxResults", "100");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira ${res.status}: ${body.slice(0, 300)}`);
    }
    const body = await res.json();

    for (const i of body.issues || []) {
      const sprintArr = i.fields[SPRINT_FIELD];
      out.push({
        jira_key:       i.key,
        summary:        i.fields.summary || null,
        description:    adfToText(i.fields.description).trim().slice(0, 1000) || null,
        status:         i.fields.status?.name || null,
        assignee_email: i.fields.assignee?.emailAddress || null,
        assignee_name:  i.fields.assignee?.displayName  || null,
        story_points:   i.fields[POINTS_FIELD] != null ? Number(i.fields[POINTS_FIELD]) : null,
        sprint:         Array.isArray(sprintArr) && sprintArr.length ? sprintArr[sprintArr.length - 1].name : null,
        project_key:    i.fields.project?.key  || null,
        project_name:   i.fields.project?.name || null,
        resolved_at:    i.fields.resolutiondate || null,
      });
    }

    nextPageToken = body.nextPageToken || null;
    safety += 1;
  } while (nextPageToken && safety < 50);

  return out;
}

// Single entry point. Routes call this; they don't care which backend runs.
export async function searchIssues({ teamId, connection, jql }) {
  if (!connection || connection.is_mock) {
    return generateMockIssues(teamId, 50);
  }
  return liveSearch(connection, jql || defaultJql());
}

// Default JQL the auto-seeded "This week" filter uses, and the fallback when
// an admin clicks Sync with no saved filters at all. Pulls anything resolved
// in the current calendar week plus anything currently in flight, so the
// dashboard always has both throughput and WIP.
export function defaultJql() {
  return 'resolved >= startOfWeek() OR (statusCategory != Done AND updated >= -14d) ORDER BY updated DESC';
}

// Persist a fresh snapshot of issues for a team. Idempotent per
// (team, key, date) — re-running the same day overwrites. Returns the count
// of issues whose assignee email matched a Skillforge user, so the sync UI
// can tell the admin how many actually mapped to known team members.
export async function snapshotIssues(teamId, filterId, issues) {
  if (issues.length === 0) return { mapped: 0 };

  const { rows: members } = await query(
    "SELECT LOWER(email) AS email, LOWER(name) AS name FROM users WHERE team_id = $1",
    [teamId]
  );
  const memberEmails = new Set(members.map((m) => m.email).filter(Boolean));
  const memberNames  = new Set(members.map((m) => m.name).filter(Boolean));

  let mapped = 0;
  for (const i of issues) {
    const emailMatch = i.assignee_email && memberEmails.has(i.assignee_email.toLowerCase());
    const nameMatch  = !emailMatch && i.assignee_name && memberNames.has(i.assignee_name.toLowerCase());
    if (emailMatch || nameMatch) mapped += 1;

    await query(
      `INSERT INTO jira_issues
         (team_id, filter_id, jira_key, summary, description, status,
          assignee_email, assignee_name, story_points, sprint, project_key, project_name, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (team_id, jira_key, snapshot_date)
       DO UPDATE SET summary = EXCLUDED.summary,
                     description = EXCLUDED.description,
                     status = EXCLUDED.status,
                     assignee_email = EXCLUDED.assignee_email,
                     assignee_name = EXCLUDED.assignee_name,
                     story_points = EXCLUDED.story_points,
                     sprint = EXCLUDED.sprint,
                     project_key = EXCLUDED.project_key,
                     project_name = EXCLUDED.project_name,
                     resolved_at = EXCLUDED.resolved_at,
                     filter_id = EXCLUDED.filter_id`,
      [
        teamId, filterId, i.jira_key, i.summary, i.description, i.status,
        i.assignee_email, i.assignee_name, i.story_points, i.sprint,
        i.project_key, i.project_name, i.resolved_at,
      ]
    );
  }
  return { mapped };
}
