import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";

const router = Router();
const MAX_CONTENT_BYTES = 500_000; // ~500 KB per doc
const MAX_TEAM_BYTES    = 50_000_000; // ~50 MB total text per team

// ─────── Folders ───────

router.get("/folders", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM kb_folders WHERE team_id = $1 ORDER BY name",
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/folders", requireAuth, async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    // If parent_id is set, verify it's in the same team.
    if (parent_id) {
      const p = await query("SELECT id FROM kb_folders WHERE id = $1 AND team_id = $2", [parent_id, req.user.team_id]);
      if (!p.rows.length) return res.status(404).json({ error: "parent folder not found" });
    }
    const { rows } = await query(
      "INSERT INTO kb_folders (team_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *",
      [req.user.team_id, name, parent_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put("/folders/:id", requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const { rows } = await query(
      "UPDATE kb_folders SET name = COALESCE($1, name) WHERE id = $2 AND team_id = $3 RETURNING *",
      [name, req.params.id, req.user.team_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/folders/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query("DELETE FROM kb_folders WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─────── Documents ───────

router.get("/documents", requireAuth, async (req, res, next) => {
  try {
    const folderId = req.query.folder_id;
    let sql = `
      SELECT d.id, d.team_id, d.folder_id, d.title,
             LENGTH(d.content) AS content_length,
             d.created_by, d.updated_by, d.created_at, d.updated_at,
             u1.name AS author_name, u2.name AS editor_name,
             ARRAY_REMOVE(ARRAY_AGG(ds.skill_id), NULL) AS skill_ids
      FROM kb_documents d
      LEFT JOIN users u1 ON u1.id = d.created_by
      LEFT JOIN users u2 ON u2.id = d.updated_by
      LEFT JOIN kb_document_skills ds ON ds.document_id = d.id
      WHERE d.team_id = $1
    `;
    const params = [req.user.team_id];
    if (folderId === "null" || folderId === "unfiled") {
      sql += " AND d.folder_id IS NULL";
    } else if (folderId) {
      sql += " AND d.folder_id = $2";
      params.push(folderId);
    }
    sql += " GROUP BY d.id, u1.name, u2.name ORDER BY d.updated_at DESC";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/documents/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.*, u1.name AS author_name, u2.name AS editor_name,
              ARRAY_REMOVE(ARRAY_AGG(ds.skill_id), NULL) AS skill_ids
       FROM kb_documents d
       LEFT JOIN users u1 ON u1.id = d.created_by
       LEFT JOIN users u2 ON u2.id = d.updated_by
       LEFT JOIN kb_document_skills ds ON ds.document_id = d.id
       WHERE d.id = $1 AND d.team_id = $2
       GROUP BY d.id, u1.name, u2.name`,
      [req.params.id, req.user.team_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post("/documents", requireAuth, async (req, res, next) => {
  try {
    const { title, content, folder_id, skill_ids } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const body = content || "";
    if (Buffer.byteLength(body) > MAX_CONTENT_BYTES) {
      return res.status(413).json({ error: `Document too large. Max ${MAX_CONTENT_BYTES / 1000} KB.` });
    }
    // Check team total.
    const { rows: usage } = await query(
      "SELECT COALESCE(SUM(LENGTH(content)), 0)::bigint AS total FROM kb_documents WHERE team_id = $1",
      [req.user.team_id]
    );
    if (Number(usage[0].total) + Buffer.byteLength(body) > MAX_TEAM_BYTES) {
      return res.status(413).json({ error: `Team storage limit (${MAX_TEAM_BYTES / 1_000_000} MB) reached.` });
    }
    if (folder_id) {
      const f = await query("SELECT id FROM kb_folders WHERE id = $1 AND team_id = $2", [folder_id, req.user.team_id]);
      if (!f.rows.length) return res.status(404).json({ error: "folder not found" });
    }
    const { rows } = await query(
      `INSERT INTO kb_documents (team_id, folder_id, title, content, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [req.user.team_id, folder_id || null, title, body, req.user.id]
    );
    if (skill_ids?.length) await syncSkills(rows[0].id, skill_ids);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put("/documents/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, content, folder_id, skill_ids } = req.body;
    const existing = await query("SELECT id FROM kb_documents WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    if (!existing.rows.length) return res.status(404).json({ error: "not found" });

    if (content !== undefined && Buffer.byteLength(content) > MAX_CONTENT_BYTES) {
      return res.status(413).json({ error: `Document too large. Max ${MAX_CONTENT_BYTES / 1000} KB.` });
    }
    const { rows } = await query(
      `UPDATE kb_documents SET
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         folder_id = $3,
         updated_by = $4,
         updated_at = NOW()
       WHERE id = $5 AND team_id = $6
       RETURNING *`,
      [title || null, content ?? null, folder_id ?? null, req.user.id, req.params.id, req.user.team_id]
    );
    if (skill_ids !== undefined) await syncSkills(rows[0].id, skill_ids);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/documents/:id", requireAuth, async (req, res, next) => {
  try {
    const doc = await query("SELECT created_by FROM kb_documents WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    if (!doc.rows.length) return res.status(404).json({ error: "not found" });
    if (doc.rows[0].created_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only the author or an admin can delete" });
    }
    await query("DELETE FROM kb_documents WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─────── Search ───────

router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length < 2) return res.json([]);
    const pattern = `%${q.trim()}%`;
    const { rows } = await query(
      `SELECT d.id, d.title, d.folder_id, d.updated_at, LENGTH(d.content) AS content_length,
              u.name AS author_name
       FROM kb_documents d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.team_id = $1 AND (d.title ILIKE $2 OR d.content ILIKE $2)
       ORDER BY d.updated_at DESC
       LIMIT 20`,
      [req.user.team_id, pattern]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ─────── Stats (for dashboard / AI) ───────

router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const [docs, folders, usage] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM kb_documents WHERE team_id = $1", [req.user.team_id]),
      query("SELECT COUNT(*)::int AS count FROM kb_folders WHERE team_id = $1", [req.user.team_id]),
      query("SELECT COALESCE(SUM(LENGTH(content)), 0)::bigint AS total FROM kb_documents WHERE team_id = $1", [req.user.team_id]),
    ]);
    res.json({
      documents: docs.rows[0].count,
      folders: folders.rows[0].count,
      storage_used: Number(usage.rows[0].total),
      storage_limit: MAX_TEAM_BYTES,
    });
  } catch (e) { next(e); }
});

// ─────── Helpers ───────

async function syncSkills(docId, skillIds) {
  await query("DELETE FROM kb_document_skills WHERE document_id = $1", [docId]);
  for (const sid of skillIds) {
    await query(
      "INSERT INTO kb_document_skills (document_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [docId, sid]
    ).catch(() => {}); // skip invalid skill IDs silently
  }
}

export default router;
