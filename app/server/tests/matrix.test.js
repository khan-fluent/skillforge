import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";

describe("GET /api/matrix", () => {
  let admin, memberA, memberB, skillX, skillY;

  beforeAll(async () => {
    admin = await createTestTeam("Matrix Test");
    memberA = await createTestMember(admin.token, { name: "Alice" });
    memberB = await createTestMember(admin.token, { name: "Bob" });

    // Create two skills
    const s1 = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "TypeScript", domain: "languages" });
    skillX = s1.body;

    const s2 = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "PostgreSQL", domain: "databases" });
    skillY = s2.body;

    // Set proficiencies
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ skill_id: skillX.id, level: 4 });

    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ skill_id: skillY.id, level: 2 });
  });

  afterAll(() => cleanupTestData());

  it("returns people, skills, and cells with correct structure", async () => {
    const res = await request()
      .get("/api/matrix")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body).toHaveProperty("people");
    expect(res.body).toHaveProperty("skills");
    expect(res.body).toHaveProperty("cells");

    // 3 people: admin + Alice + Bob
    expect(res.body.people).toHaveLength(3);
    // 2 skills
    expect(res.body.skills).toHaveLength(2);
  });

  it("cells map contains correct proficiency levels", async () => {
    const res = await request()
      .get("/api/matrix")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const { cells } = res.body;

    expect(cells[`${memberA.user.id}:${skillX.id}`]).toBe(4);
    expect(cells[`${memberB.user.id}:${skillY.id}`]).toBe(2);
    // No proficiency set for Alice on PostgreSQL
    expect(cells[`${memberA.user.id}:${skillY.id}`]).toBeUndefined();
  });
});
