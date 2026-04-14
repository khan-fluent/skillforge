import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";
import { searchIssues, snapshotIssues, generateMockIssues, defaultJql } from "../services/jira.js";
import { encrypt, decrypt } from "../services/crypto.js";

const router = Router();

async function getConnection(teamId) {
  const { rows } = await query("SELECT * FROM jira_connections WHERE team_id = $1", [teamId]);
  if (!rows[0]) return null;
  // Decrypt the stored token so downstream callers (Jira API) get the real value
  try {
    rows[0].api_token = decrypt(rows[0].api_token);
  } catch {
    // Token may be stored as plaintext from before encryption was added — use as-is
  }
  return rows[0];
}

// ─────────────── Connection ───────────────

router.get("/connection", requireAuth, async (req, res) => {
  const conn = await getConnection(req.user.team_id);
  if (!conn) return res.json({ connected: false, mock: true });
  const { api_token, ...safe } = conn;
  res.json({ connected: true, mock: conn.is_mock, ...safe });
});

router.post("/connection", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { base_url, email, api_token } = req.body;
    if (!base_url || !email || !api_token) {
      return res.status(400).json({ error: "base_url, email, api_token required" });
    }
    const encryptedToken = encrypt(api_token);
    const { rows } = await query(
      `INSERT INTO jira_connections (team_id, base_url, email, api_token, is_mock)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (team_id) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         email = EXCLUDED.email,
         api_token = EXCLUDED.api_token,
         is_mock = false
       RETURNING id, team_id, base_url, email, is_mock, last_sync_at`,
      [req.user.team_id, base_url, email, encryptedToken]
    );

    // First-run convenience: if the team has no saved filters, seed a sensible
    // default so the very first sync produces meaningful data without forcing
    // the admin to learn JQL syntax first.
    const existing = await query("SELECT id FROM jira_filters WHERE team_id = $1", [req.user.team_id]);
    if (existing.rows.length === 0) {
      await query(
        "INSERT INTO jira_filters (team_id, name, jql) VALUES ($1, $2, $3)",
        [req.user.team_id, "This week", defaultJql()]
      );
    }

    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/connection", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM jira_connections WHERE team_id = $1", [req.user.team_id]);
  res.status(204).end();
});

// ─────────────── Filters ───────────────

router.get("/filters", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, name, jql, created_at FROM jira_filters WHERE team_id = $1 ORDER BY created_at",
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/filters", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, jql } = req.body;
    if (!name || !jql) return res.status(400).json({ error: "name and jql required" });
    const { rows } = await query(
      "INSERT INTO jira_filters (team_id, name, jql) VALUES ($1, $2, $3) RETURNING *",
      [req.user.team_id, name, jql]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/filters/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query("DELETE FROM jira_filters WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─────────────── Sync (manual) ───────────────

router.post("/sync", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const conn = await getConnection(req.user.team_id);
    const filters = (await query("SELECT * FROM jira_filters WHERE team_id = $1", [req.user.team_id])).rows;

    let totalSynced = 0;
    let totalMapped = 0;
    const errors = [];

    if (filters.length === 0) {
      // No saved filter — sync the default JQL once.
      try {
        const issues = await searchIssues({ teamId: req.user.team_id, connection: conn, jql: defaultJql() });
        const { mapped } = await snapshotIssues(req.user.team_id, null, issues);
        totalSynced += issues.length;
        totalMapped += mapped;
      } catch (e) { errors.push({ filter: "default", error: e.message }); }
    } else {
      for (const f of filters) {
        try {
          const issues = await searchIssues({ teamId: req.user.team_id, connection: conn, jql: f.jql });
          const { mapped } = await snapshotIssues(req.user.team_id, f.id, issues);
          totalSynced += issues.length;
          totalMapped += mapped;
        } catch (e) { errors.push({ filter: f.name, error: e.message }); }
      }
    }

    if (conn) {
      await query("UPDATE jira_connections SET last_sync_at = NOW() WHERE team_id = $1", [req.user.team_id]);
    }

    res.json({ synced: totalSynced, mapped: totalMapped, errors });
  } catch (e) { next(e); }
});

// ─────────────── Summary (powers the dashboard widget) ───────────────

router.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const conn = await getConnection(req.user.team_id);

    // Prefer the most recent stored snapshot. If nothing is stored yet (e.g.
    // pre-connect), fall back to ephemeral mock data so the widget never
    // shows an empty state on the dashboard.
    const stored = await query(
      `SELECT jira_key, summary, description, status, assignee_email, assignee_name,
              story_points, sprint, project_key, project_name, resolved_at
       FROM jira_issues
       WHERE team_id = $1 AND snapshot_date = (
         SELECT MAX(snapshot_date) FROM jira_issues WHERE team_id = $1
       )`,
      [req.user.team_id]
    );

    let issues = stored.rows;
    let isMock = !conn || conn.is_mock;
    if (!issues.length) {
      issues = await generateMockIssues(req.user.team_id, 50);
      isMock = true;
    }

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const byPerson = {};

    for (const i of issues) {
      const key = (i.assignee_email || i.assignee_name || "unassigned").toLowerCase();
      if (!byPerson[key]) {
        byPerson[key] = {
          name: i.assignee_name || "Unassigned",
          email: i.assignee_email || null,
          issues_total: 0,
          issues_done_week: 0,
          points_done_week: 0,
          in_progress: 0,
          done_titles: [],
          top_ticket: null,
        };
      }
      const p = byPerson[key];
      p.issues_total += 1;

      const inFlight = i.status === "In Progress" || i.status === "In Review";
      if (inFlight) p.in_progress += 1;

      const isDoneThisWeek = i.status === "Done" && i.resolved_at && new Date(i.resolved_at).getTime() > sevenDaysAgo;
      if (isDoneThisWeek) {
        const points = Number(i.story_points || 0);
        p.issues_done_week += 1;
        p.points_done_week += points;
        p.done_titles.push({ key: i.jira_key, summary: i.summary, points });

        // Top ticket = highest story points among this week's done work.
        // Tie-breaker: most recent resolution date.
        if (
          !p.top_ticket ||
          points > (p.top_ticket.points || 0) ||
          (points === (p.top_ticket.points || 0) && new Date(i.resolved_at) > new Date(p.top_ticket.resolved_at))
        ) {
          p.top_ticket = {
            key: i.jira_key,
            summary: i.summary,
            description: i.description,
            points,
            project: i.project_name || i.project_key,
            resolved_at: i.resolved_at,
          };
        }
      }
    }

    const people = Object.values(byPerson)
      .filter((p) => p.issues_total > 0)
      .sort((a, b) => b.points_done_week - a.points_done_week);

    res.json({
      connected: !!conn && !conn.is_mock,
      mock: isMock,
      last_sync_at: conn?.last_sync_at || null,
      total_issues: issues.length,
      total_points_week: people.reduce((s, p) => s + p.points_done_week, 0),
      total_done_week: people.reduce((s, p) => s + p.issues_done_week, 0),
      people,
    });
  } catch (e) { next(e); }
});

// Issue list — full snapshot for the (future) Tickets page and chat snapshot.
router.get("/issues", requireAuth, async (req, res, next) => {
  try {
    const stored = await query(
      `SELECT * FROM jira_issues
       WHERE team_id = $1 AND snapshot_date = (
         SELECT MAX(snapshot_date) FROM jira_issues WHERE team_id = $1
       )
       ORDER BY resolved_at DESC NULLS LAST
       LIMIT 200`,
      [req.user.team_id]
    );
    if (stored.rows.length) return res.json(stored.rows);
    res.json(await generateMockIssues(req.user.team_id, 50));
  } catch (e) { next(e); }
});

export default router;
