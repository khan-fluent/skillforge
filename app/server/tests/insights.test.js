import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";
import { query } from "../db/index.js";

let admin, member;

beforeAll(async () => {
  const team = await createTestTeam("Insights Team");
  admin = team;
  member = await createTestMember(admin.token, { name: "Ada Lovelace" });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("GET /api/insights", () => {
  it("returns an array", async () => {
    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("generates a critical gap insight when no one is at level 4+", async () => {
    // Create a skill and give the member a low proficiency (level 2)
    const skillRes = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Quantum Computing", domain: "Engineering" });
    const skill = skillRes.body;

    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skill.id, level: 2 });

    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const gap = res.body.find(
      (i) => i.type === "gap" && i.skill_id === skill.id
    );
    expect(gap).toBeDefined();
    expect(gap.priority).toBe("critical");
    expect(gap.title).toContain("Quantum Computing");
  });

  it("generates an upskill insight when one person is at 4+ and another at 3", async () => {
    // Create a skill, give admin level 4, member level 3
    const skillRes = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Rust Programming", domain: "Engineering" });
    const skill = skillRes.body;

    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skill.id, level: 4 });

    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skill.id, level: 3 });

    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const upskill = res.body.find(
      (i) => i.type === "upskill" && i.skill_id === skill.id
    );
    expect(upskill).toBeDefined();
    expect(upskill.priority).toBe("high");
    expect(upskill.title).toContain("Ada Lovelace");
    expect(upskill.title).toContain("Rust Programming");
  });

  it("generates a cert insight for an expired certification", async () => {
    // Create a certification that expired yesterday
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        name: "AWS Solutions Architect",
        issuer: "Amazon",
        expires_on: yesterday,
      });

    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const cert = res.body.find((i) => i.type === "cert");
    expect(cert).toBeDefined();
    expect(cert.title).toContain("AWS Solutions Architect");
    expect(cert.title).toContain("expired");
  });

  it("sorts insights by priority with critical first", async () => {
    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const priorities = res.body.map((i) => i.priority);
    const order = { critical: 0, high: 1, medium: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]]).toBeGreaterThanOrEqual(
        order[priorities[i - 1]]
      );
    }
  });

  it("caps insights at 6", async () => {
    // Create many skills with gap conditions to exceed 6 insights
    for (let i = 0; i < 8; i++) {
      const skillRes = await request()
        .post("/api/skills")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: `CapTest Skill ${i}`, domain: "Testing" });

      await request()
        .post("/api/proficiencies")
        .set("Authorization", `Bearer ${member.token}`)
        .send({ skill_id: skillRes.body.id, level: 1 });
    }

    const res = await request()
      .get("/api/insights")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(6);
  });
});
