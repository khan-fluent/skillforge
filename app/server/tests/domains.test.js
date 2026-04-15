import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";
import { query } from "../db/index.js";

let admin, member, teamB;

beforeAll(async () => {
  const team = await createTestTeam("Domains Test Team");
  admin = team;
  member = await createTestMember(admin.token);
  teamB = await createTestTeam("Domains Team B");
});

afterAll(async () => {
  await cleanupTestData();
});

// ─────── CRUD ───────

describe("GET /api/domains", () => {
  it("returns empty array when no domains exist", async () => {
    const res = await request()
      .get("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns domains with stats after creation", async () => {
    await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Payments", category: "Product", description: "Payment processing" });

    const res = await request()
      .get("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const payments = res.body.find((d) => d.name === "Payments");
    expect(payments).toBeDefined();
    expect(payments.category).toBe("Product");
    expect(payments).toHaveProperty("people_count");
    expect(payments).toHaveProperty("avg_level");
    expect(payments).toHaveProperty("proficient_count");
  });

  it("does not leak domains across teams", async () => {
    const res = await request()
      .get("/api/domains")
      .set("Authorization", `Bearer ${teamB.token}`);

    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).not.toContain("Payments");
  });
});

describe("POST /api/domains", () => {
  it("admin creates a domain", async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Billing", category: "Finance" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Billing");
    expect(res.body.category).toBe("Finance");
    expect(res.body.team_id).toBe(admin.team.id);
  });

  it("defaults category to 'general'", async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Internal Tools" });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe("general");
  });

  it("member gets 403", async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Unauthorized Domain" });

    expect(res.status).toBe(403);
  });

  it("requires name", async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ category: "Product" });

    expect(res.status).toBe(400);
  });

  it("upserts on duplicate name within team", async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Billing", category: "Updated Category", description: "updated desc" });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe("Updated Category");
    expect(res.body.description).toBe("updated desc");
  });
});

describe("PUT /api/domains/:id", () => {
  it("admin updates a domain", async () => {
    const createRes = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Logistics", category: "Ops" });

    const res = await request()
      .put(`/api/domains/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Supply Chain", description: "End-to-end logistics" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Supply Chain");
    expect(res.body.description).toBe("End-to-end logistics");
  });

  it("member gets 403", async () => {
    const { rows } = await query(
      "SELECT id FROM domains WHERE team_id = $1 LIMIT 1",
      [admin.team.id]
    );

    const res = await request()
      .put(`/api/domains/${rows[0].id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Nope" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent domain", async () => {
    const res = await request()
      .put("/api/domains/999999")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/domains/:id", () => {
  it("admin deletes a domain", async () => {
    const createRes = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Disposable Domain" });

    const res = await request()
      .delete(`/api/domains/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const listRes = await request()
      .get("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`);

    const names = listRes.body.map((d) => d.name);
    expect(names).not.toContain("Disposable Domain");
  });

  it("member gets 403", async () => {
    const createRes = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Protected Domain" });

    const res = await request()
      .delete(`/api/domains/${createRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });
});

// ─────── Proficiencies ───────

describe("POST /api/domains/proficiencies", () => {
  let domainId;

  beforeAll(async () => {
    const res = await request()
      .post("/api/domains")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Auth Systems", category: "Security" });
    domainId = res.body.id;
  });

  it("sets proficiency for the current user", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ domain_id: domainId, level: 4, notes: "Implemented OAuth2" });

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(admin.user.id);
    expect(res.body.domain_id).toBe(domainId);
    expect(res.body.level).toBe(4);
    expect(res.body.notes).toBe("Implemented OAuth2");
  });

  it("upserts on duplicate user+domain", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ domain_id: domainId, level: 5 });

    expect(res.status).toBe(200);
    expect(res.body.level).toBe(5);
  });

  it("sets proficiency for another user via user_id", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ user_id: member.user.id, domain_id: domainId, level: 2 });

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(member.user.id);
    expect(res.body.level).toBe(2);
  });

  it("requires domain_id and level", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ level: 3 });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent domain", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ domain_id: 999999, level: 3 });

    expect(res.status).toBe(404);
  });

  it("member can set their own proficiency", async () => {
    const res = await request()
      .post("/api/domains/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ domain_id: domainId, level: 3 });

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(member.user.id);
    expect(res.body.level).toBe(3);
  });
});

// ─────── Gaps ───────

describe("GET /api/domains/gaps", () => {
  it("returns bus factor analysis with summary", async () => {
    const res = await request()
      .get("/api/domains/gaps")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("domains");
    expect(res.body.summary).toHaveProperty("critical");
    expect(res.body.summary).toHaveProperty("high_risk");
    expect(res.body.summary).toHaveProperty("healthy");
    expect(res.body.summary).toHaveProperty("total");
    expect(res.body.summary.total).toBeGreaterThanOrEqual(1);
  });

  it("domains include bus_factor and proficient_people", async () => {
    const res = await request()
      .get("/api/domains/gaps")
      .set("Authorization", `Bearer ${admin.token}`);

    const domain = res.body.domains.find((d) => d.name === "Auth Systems");
    expect(domain).toBeDefined();
    expect(domain).toHaveProperty("bus_factor");
    expect(domain).toHaveProperty("total_known");
    expect(domain).toHaveProperty("proficient_people");
    // Admin set level 5 (>= 4 counts as proficient)
    expect(domain.bus_factor).toBeGreaterThanOrEqual(1);
  });

  it("returns sorted by bus_factor ascending (riskiest first)", async () => {
    const res = await request()
      .get("/api/domains/gaps")
      .set("Authorization", `Bearer ${admin.token}`);

    const factors = res.body.domains.map((d) => d.bus_factor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThanOrEqual(factors[i - 1]);
    }
  });
});

// ─────── Matrix ───────

describe("GET /api/domains/matrix", () => {
  it("returns members, domains, and proficiency map", async () => {
    const res = await request()
      .get("/api/domains/matrix")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("members");
    expect(res.body).toHaveProperty("domains");
    expect(res.body).toHaveProperty("proficiencies");

    expect(Array.isArray(res.body.members)).toBe(true);
    expect(Array.isArray(res.body.domains)).toBe(true);
    expect(typeof res.body.proficiencies).toBe("object");
  });

  it("members include id, name, job_title", async () => {
    const res = await request()
      .get("/api/domains/matrix")
      .set("Authorization", `Bearer ${admin.token}`);

    const adminEntry = res.body.members.find((m) => m.id === admin.user.id);
    expect(adminEntry).toBeDefined();
    expect(adminEntry).toHaveProperty("name");
    expect(adminEntry).toHaveProperty("job_title");
  });

  it("proficiencies map has user-domain keys with levels", async () => {
    const res = await request()
      .get("/api/domains/matrix")
      .set("Authorization", `Bearer ${admin.token}`);

    // Find the Auth Systems domain
    const authDomain = res.body.domains.find((d) => d.name === "Auth Systems");
    expect(authDomain).toBeDefined();

    const key = `${admin.user.id}-${authDomain.id}`;
    expect(res.body.proficiencies[key]).toBeDefined();
    expect(res.body.proficiencies[key]).toBe(5); // Admin set level 5 earlier
  });

  it("does not include users from other teams", async () => {
    const res = await request()
      .get("/api/domains/matrix")
      .set("Authorization", `Bearer ${admin.token}`);

    const memberIds = res.body.members.map((m) => m.id);
    expect(memberIds).toContain(admin.user.id);
    expect(memberIds).toContain(member.user.id);
    // teamB admin should NOT appear
    expect(memberIds).not.toContain(teamB.user.id);
  });
});
