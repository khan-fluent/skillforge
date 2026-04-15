import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";

describe("GET /api/gaps", () => {
  let admin, memberA, memberB;
  let criticalSkill, highRiskSkill, healthySkill;

  beforeAll(async () => {
    admin = await createTestTeam("Gaps Test");
    memberA = await createTestMember(admin.token, { name: "Alice" });
    memberB = await createTestMember(admin.token, { name: "Bob" });

    // Create three skills
    const s1 = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "CriticalLang", domain: "languages" });
    criticalSkill = s1.body;

    const s2 = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "RiskyDB", domain: "databases" });
    highRiskSkill = s2.body;

    const s3 = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "HealthyTool", domain: "tools" });
    healthySkill = s3.body;

    // CriticalLang: nobody at level 4+ -> bus_factor = 0
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ skill_id: criticalSkill.id, level: 2 });

    // RiskyDB: exactly 1 person at level 4+ -> bus_factor = 1
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ skill_id: highRiskSkill.id, level: 5 });

    // HealthyTool: 2 people at level 4+ -> bus_factor = 2
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ skill_id: healthySkill.id, level: 4 });

    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ skill_id: healthySkill.id, level: 5 });
  });

  afterAll(() => cleanupTestData());

  it("returns summary with correct counts", async () => {
    const res = await request()
      .get("/api/gaps")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.summary).toEqual({
      critical: 1,
      high_risk: 1,
      healthy: 1,
      total: 3,
    });
  });

  it("returns skills sorted by bus_factor ascending", async () => {
    const res = await request()
      .get("/api/gaps")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const { skills } = res.body;
    expect(skills).toHaveLength(3);

    expect(skills[0].name).toBe("CriticalLang");
    expect(skills[0].bus_factor).toBe(0);

    expect(skills[1].name).toBe("RiskyDB");
    expect(skills[1].bus_factor).toBe(1);

    expect(skills[2].name).toBe("HealthyTool");
    expect(skills[2].bus_factor).toBe(2);
  });

  it("each skill has expected fields", async () => {
    const res = await request()
      .get("/api/gaps")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const skill = res.body.skills[0];
    expect(skill).toHaveProperty("id");
    expect(skill).toHaveProperty("name");
    expect(skill).toHaveProperty("domain");
    expect(skill).toHaveProperty("bus_factor");
    expect(skill).toHaveProperty("total_known");
    expect(skill).toHaveProperty("proficient_people");
  });
});
