import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";

let admin, member;

beforeAll(async () => {
  admin = await createTestTeam("Skills Test Team");
  member = await createTestMember(admin.token);
});

afterAll(async () => {
  await cleanupTestData();
});

describe("GET /api/skills", () => {
  it("returns empty array when no skills exist", async () => {
    const res = await request()
      .get("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns skills with stats (people_count, avg_level, proficient_count)", async () => {
    // Create a skill
    const skillRes = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Node.js", domain: "languages" });
    const skillId = skillRes.body.id;

    // Add proficiencies for both users
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skillId, level: 5 });
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skillId, level: 4, user_id: member.user.id });

    const res = await request()
      .get("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const skill = res.body.find((s) => s.id === skillId);
    expect(skill).toBeDefined();
    expect(skill.people_count).toBe(2);
    expect(skill.avg_level).toBe(4.5);
    expect(skill.proficient_count).toBe(2); // both >= 4
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request().get("/api/skills");
    expect(res.status).toBe(401);
  });

  it("does not return skills from another team", async () => {
    const other = await createTestTeam("Other Team");
    await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ name: "Rust", domain: "languages" });

    const res = await request()
      .get("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`);

    const rustSkill = res.body.find((s) => s.name === "Rust");
    expect(rustSkill).toBeUndefined();
  });
});

describe("POST /api/skills", () => {
  it("admin can create a skill with name and domain", async () => {
    const res = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "PostgreSQL", domain: "databases", description: "Relational DB" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("PostgreSQL");
    expect(res.body.domain).toBe("databases");
    expect(res.body.description).toBe("Relational DB");
    expect(res.body.deprecated).toBe(false);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ domain: "databases" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when domain is missing", async () => {
    const res = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "MySQL" });
    expect(res.status).toBe(400);
  });

  it("member gets 403", async () => {
    const res = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Go", domain: "languages" });
    expect(res.status).toBe(403);
  });

  it("upserts on duplicate name within same team", async () => {
    await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Upsert-Skill", domain: "tools" });

    const res = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Upsert-Skill", domain: "cloud", description: "updated" });

    expect(res.status).toBe(201);
    expect(res.body.domain).toBe("cloud");
    expect(res.body.description).toBe("updated");
  });
});

describe("POST /api/skills/bulk", () => {
  it("admin can bulk import skills", async () => {
    const res = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        skills: [
          { name: "Docker", domain: "tools" },
          { name: "Kubernetes", domain: "cloud", description: "Container orchestration" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
    expect(res.body.skills).toHaveLength(2);
  });

  it("skips duplicates (ON CONFLICT DO NOTHING)", async () => {
    // First insert
    await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skills: [{ name: "BulkDupe", domain: "tools" }] });

    // Second insert with same name
    const res = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        skills: [
          { name: "BulkDupe", domain: "tools" },
          { name: "NewSkill", domain: "tools" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.added).toBe(1); // only NewSkill added
  });

  it("skips entries missing name or domain", async () => {
    const res = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        skills: [
          { name: "ValidSkill", domain: "tools" },
          { domain: "tools" },        // missing name
          { name: "NoCategory" },      // missing domain
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.added).toBe(1);
  });

  it("returns 400 for empty or missing skills array", async () => {
    const res1 = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skills: [] });
    expect(res1.status).toBe(400);

    const res2 = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(res2.status).toBe(400);
  });

  it("member gets 403", async () => {
    const res = await request()
      .post("/api/skills/bulk")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skills: [{ name: "Terraform", domain: "tools" }] });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/skills/:id", () => {
  it("admin can update a skill", async () => {
    const create = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "UpdateMe", domain: "tools" });

    const res = await request()
      .put(`/api/skills/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Updated", domain: "cloud", deprecated: true });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
    expect(res.body.domain).toBe("cloud");
    expect(res.body.deprecated).toBe(true);
  });

  it("returns 404 for non-existent skill", async () => {
    const res = await request()
      .put("/api/skills/999999")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("member gets 403", async () => {
    const create = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "MemberCantUpdate", domain: "tools" });

    const res = await request()
      .put(`/api/skills/${create.body.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/skills/:id", () => {
  it("admin can delete a skill", async () => {
    const create = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "DeleteMe", domain: "tools" });

    const res = await request()
      .delete(`/api/skills/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    // Verify it's gone
    const list = await request()
      .get("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`);
    const found = list.body.find((s) => s.name === "DeleteMe");
    expect(found).toBeUndefined();
  });

  it("member gets 403", async () => {
    const create = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "MemberCantDelete", domain: "tools" });

    const res = await request()
      .delete(`/api/skills/${create.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(res.status).toBe(403);
  });
});
