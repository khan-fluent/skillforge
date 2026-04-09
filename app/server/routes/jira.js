import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";
import { searchIssues, snapshotIssues, generateMockIssues } from "../services/jira.js";

const router = Router();

async function getConnection(teamId) {
  const { rows } = await query("SELECT * FROM jira_connections WHERE team_id = $1", [teamId]);
  return rows[0] || null;
}

// Connection
router.get("/connection", requireAuth, async (req, res) => {
  const conn = await getConnection(req.user.team_id);
  if (!conn) return res.json({ connected: false, mock: true });
  // Never leak the api_token.
  const { api_token, ...safe } = conn;
  res.json({ connected: true, mock: conn.is_mock, ...safe });
});

router.post("/connection", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { base_url, email, api_token } = req.body;
    if (!base_url || !email || !api_token) {
      return res.status(400).json({ error: "base_url, email, api_token required" });
    }
    const { rows } = await query(
      `INSERT INTO jira_connections (team_id, base_url, email, api_token, is_mock)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (team_id) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         email = EXCLUDED.email,
         api_token = EXCLUDED.api_token,
         is_mock = false
       RETURNING id, team_id, base_url, email, is_mock, last_sync_at`,
      [req.user.team_id, base_url, email, api_token]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/connection", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM jira_connections WHERE team_id = $1", [req.user.team_id]);
  res.status(204).end();
});

// Filters
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

// Sync now — admin manually triggers a snapshot. Defaults to all filters.
router.post("/sync", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const conn = await getConnection(req.user.team_id);
    const filters = (await query("SELECT * FROM jira_filters WHERE team_id = $1", [req.user.team_id])).rows;
    let total = 0;
    if (filters.length === 0) {
      const issues = await searchIssues({ teamId: req.user.team_id, connection: conn, jql: null });
      await snapshotIssues(req.user.team_id, null, issues);
      total = issues.length;
    } else {
      for (const f of filters) {
        const issues = await searchIssues({ teamId: req.user.team_id, connection: conn, jql: f.jql });
        await snapshotIssues(req.user.team_id, f.id, issues);
        total += issues.length;
      }
    }
    if (conn) {
      await query("UPDATE jira_connections SET last_sync_at = NOW() WHERE team_id = $1", [req.user.team_id]);
    }
    res.json({ synced: total });
  } catch (e) { next(e); }
});

// Live summary for the dashboard widget. If no real connection or stored
// snapshot exists, generate mock data on the fly so the widget is always
// populated. Aggregates per assignee for the last 7 days of resolved work.
router.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const conn = await getConnection(req.user.team_id);

    // Try the snapshot table first.
    const stored = await query(
      `SELECT assignee_name, assignee_email, status, story_points, resolved_at, sprint
       FROM jira_issues
       WHERE team_id = $1 AND snapshot_date = (
         SELECT MAX(snapshot_date) FROM jira_issues WHERE team_id = $1
       )`,
      [req.user.team_id]
    );

    let issues = stored.rows;
    let isMock = !conn || conn.is_mock;

    if (!issues.length) {
      // Fall back to ephemeral mock so the widget is never empty.
      issues = await generateMockIssues(req.user.team_id, 50);
      isMock = true;
    }

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const byPerson = {};
    for (const i of issues) {
      const key = i.assignee_email || i.assignee_name || "unassigned";
      if (!byPerson[key]) {
        byPerson[key] = {
          name: i.assignee_name || "Unassigned",
          email: i.assignee_email || null,
          issues_total: 0,
          issues_done_week: 0,
          points_done_week: 0,
          in_progress: 0,
        };
      }
      const p = byPerson[key];
      p.issues_total += 1;
      if (i.status === "In Progress" || i.status === "In Review") p.in_progress += 1;
      if (i.status === "Done" && i.resolved_at && new Date(i.resolved_at).getTime() > sevenDaysAgo) {
        p.issues_done_week += 1;
        p.points_done_week += Number(i.story_points || 0);
      }
    }
    const people = Object.values(byPerson).sort((a, b) => b.points_done_week - a.points_done_week);

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

// Issue list — for the (future) full Tickets page. Already wired so the
// chat assistant can pull it via the snapshot service.
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
    const issues = await generateMockIssues(req.user.team_id, 50);
    res.json(issues);
  } catch (e) { next(e); }
});

export default router;
