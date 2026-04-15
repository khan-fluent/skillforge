import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";
import { query } from "../db/index.js";

let admin, member, teamB;
let folderId, skillId;

beforeAll(async () => {
  const team = await createTestTeam("KB Test Team");
  admin = team;
  member = await createTestMember(admin.token);
  teamB = await createTestTeam("KB Team B");

  // Create a skill for document-skill linking tests
  const { rows } = await query(
    "INSERT INTO skills (team_id, name, domain) VALUES ($1, 'Kubernetes', 'Infrastructure') RETURNING id",
    [admin.team.id]
  );
  skillId = rows[0].id;
});

afterAll(async () => {
  await cleanupTestData();
});

// ─────── Folders ───────

describe("KB Folders", () => {
  it("GET /api/kb/folders returns empty array initially", async () => {
    const res = await request()
      .get("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/kb/folders creates a folder", async () => {
    const res = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Runbooks" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Runbooks");
    expect(res.body.team_id).toBe(admin.team.id);
    folderId = res.body.id;
  });

  it("POST /api/kb/folders requires name", async () => {
    const res = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("POST /api/kb/folders supports parent_id", async () => {
    const res = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Sub Folder", parent_id: folderId });

    expect(res.status).toBe(201);
    expect(res.body.parent_id).toBe(folderId);
  });

  it("POST /api/kb/folders rejects invalid parent_id", async () => {
    const res = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Orphan", parent_id: 999999 });

    expect(res.status).toBe(404);
  });

  it("PUT /api/kb/folders/:id renames a folder", async () => {
    const res = await request()
      .put(`/api/kb/folders/${folderId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Playbooks" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Playbooks");
  });

  it("DELETE /api/kb/folders/:id requires admin", async () => {
    const folderRes = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Member Folder" });

    const res = await request()
      .delete(`/api/kb/folders/${folderRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it("DELETE /api/kb/folders/:id succeeds for admin", async () => {
    const folderRes = await request()
      .post("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Disposable" });

    const res = await request()
      .delete(`/api/kb/folders/${folderRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });

  it("GET /api/kb/folders lists created folders", async () => {
    const res = await request()
      .get("/api/kb/folders")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const names = res.body.map((f) => f.name);
    expect(names).toContain("Playbooks");
  });
});

// ─────── Documents ───────

describe("KB Documents", () => {
  let docId;

  it("POST /api/kb/documents creates a document", async () => {
    const res = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Incident Response Guide",
        content: "Step 1: Don't panic. Step 2: Check dashboards.",
        folder_id: folderId,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Incident Response Guide");
    expect(res.body.folder_id).toBe(folderId);
    expect(res.body.created_by).toBe(admin.user.id);
    docId = res.body.id;
  });

  it("POST /api/kb/documents requires title", async () => {
    const res = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ content: "no title here" });

    expect(res.status).toBe(400);
  });

  it("POST /api/kb/documents with skill_ids links to skills", async () => {
    const res = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "K8s Troubleshooting",
        content: "kubectl get pods",
        skill_ids: [skillId],
      });

    expect(res.status).toBe(201);

    // Verify link exists
    const { rows } = await query(
      "SELECT skill_id FROM kb_document_skills WHERE document_id = $1",
      [res.body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].skill_id).toBe(skillId);
  });

  it("GET /api/kb/documents lists documents", async () => {
    const res = await request()
      .get("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("content_length");
    expect(res.body[0]).toHaveProperty("skill_ids");
  });

  it("GET /api/kb/documents filters by folder_id", async () => {
    const res = await request()
      .get(`/api/kb/documents?folder_id=${folderId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    res.body.forEach((doc) => {
      expect(doc.folder_id).toBe(folderId);
    });
  });

  it("GET /api/kb/documents filters unfiled docs", async () => {
    // Create an unfiled doc
    await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Unfiled Note", content: "loose doc" });

    const res = await request()
      .get("/api/kb/documents?folder_id=null")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    res.body.forEach((doc) => {
      expect(doc.folder_id).toBeNull();
    });
  });

  it("GET /api/kb/documents/:id returns full detail", async () => {
    const res = await request()
      .get(`/api/kb/documents/${docId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Incident Response Guide");
    expect(res.body.content).toContain("Don't panic");
    expect(res.body.author_name).toBeDefined();
    expect(res.body.skill_ids).toBeDefined();
  });

  it("GET /api/kb/documents/:id returns 404 for wrong team", async () => {
    const res = await request()
      .get(`/api/kb/documents/${docId}`)
      .set("Authorization", `Bearer ${teamB.token}`);

    expect(res.status).toBe(404);
  });

  it("PUT /api/kb/documents/:id updates title and content", async () => {
    const res = await request()
      .put(`/api/kb/documents/${docId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Updated Guide", content: "New content here" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Guide");
    expect(res.body.updated_by).toBe(admin.user.id);
  });

  it("PUT /api/kb/documents/:id can update skill_ids", async () => {
    const res = await request()
      .put(`/api/kb/documents/${docId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_ids: [skillId] });

    expect(res.status).toBe(200);

    const { rows } = await query(
      "SELECT skill_id FROM kb_document_skills WHERE document_id = $1",
      [docId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].skill_id).toBe(skillId);
  });

  it("DELETE /api/kb/documents/:id by author succeeds", async () => {
    // Member creates a doc, then deletes it
    const docRes = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Member Doc", content: "member content" });

    const res = await request()
      .delete(`/api/kb/documents/${docRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(204);
  });

  it("DELETE /api/kb/documents/:id by non-author member returns 403", async () => {
    // Admin creates a doc, member tries to delete
    const docRes = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Doc", content: "admin content" });

    const res = await request()
      .delete(`/api/kb/documents/${docRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it("DELETE /api/kb/documents/:id by admin always succeeds", async () => {
    // Member creates, admin deletes
    const docRes = await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Member Deletable", content: "will be deleted by admin" });

    const res = await request()
      .delete(`/api/kb/documents/${docRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });
});

// ─────── Search ───────

describe("GET /api/kb/search", () => {
  it("finds documents by title keyword", async () => {
    await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Terraform Best Practices", content: "Use modules." });

    const res = await request()
      .get("/api/kb/search?q=Terraform")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].title).toContain("Terraform");
  });

  it("finds documents by content keyword", async () => {
    await request()
      .post("/api/kb/documents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "CI Pipeline", content: "GitHub Actions workflow with matrix strategy" });

    const res = await request()
      .get("/api/kb/search?q=matrix+strategy")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for short query", async () => {
    const res = await request()
      .get("/api/kb/search?q=a")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("does not return docs from other teams", async () => {
    const res = await request()
      .get("/api/kb/search?q=Terraform")
      .set("Authorization", `Bearer ${teamB.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ─────── Stats ───────

describe("GET /api/kb/stats", () => {
  it("returns document, folder, and storage counts", async () => {
    const res = await request()
      .get("/api/kb/stats")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toBeGreaterThanOrEqual(1);
    expect(res.body.folders).toBeGreaterThanOrEqual(1);
    expect(res.body.storage_used).toBeGreaterThan(0);
    expect(res.body.storage_limit).toBe(50_000_000);
  });
});

// ─────── By Skill ───────

describe("GET /api/kb/by-skill/:skillId", () => {
  it("returns documents linked to a skill", async () => {
    const res = await request()
      .get(`/api/kb/by-skill/${skillId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("title");
    expect(res.body[0]).toHaveProperty("author_name");
  });

  it("returns empty array for skill with no docs", async () => {
    const { rows } = await query(
      "INSERT INTO skills (team_id, name, domain) VALUES ($1, 'Obscure Skill', 'Misc') RETURNING id",
      [admin.team.id]
    );

    const res = await request()
      .get(`/api/kb/by-skill/${rows[0].id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
