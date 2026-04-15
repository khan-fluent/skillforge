import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";
import { query } from "../db/index.js";

let admin, member, otherMember, skillId;

beforeAll(async () => {
  admin = await createTestTeam("Proficiency Test Team");
  member = await createTestMember(admin.token);
  otherMember = await createTestMember(admin.token, { name: "Other Member" });

  // Create a skill for proficiency tests
  const res = await request()
    .post("/api/skills")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ name: "TypeScript", domain: "languages" });
  skillId = res.body.id;
});

afterAll(async () => {
  await cleanupTestData();
});

describe("POST /api/proficiencies", () => {
  it("member can set own proficiency", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 3 });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(member.user.id);
    expect(res.body.skill_id).toBe(skillId);
    expect(res.body.level).toBe(3);
    expect(res.body.source).toBe("self");
  });

  it("admin can set own proficiency", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skillId, level: 5 });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(admin.user.id);
    expect(res.body.source).toBe("self");
  });

  it("admin can set another user's proficiency via user_id", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skillId, level: 4, user_id: otherMember.user.id });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(otherMember.user.id);
    expect(res.body.level).toBe(4);
    expect(res.body.source).toBe("lead");
  });

  it("member cannot set another user's proficiency (403)", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 2, user_id: otherMember.user.id });

    expect(res.status).toBe(403);
  });

  it("upsert: sending again updates the level", async () => {
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 2 });

    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 5 });

    expect(res.status).toBe(201);
    expect(res.body.level).toBe(5);

    // Confirm only one row exists
    const { rows } = await query(
      "SELECT * FROM proficiencies WHERE user_id = $1 AND skill_id = $2",
      [member.user.id, skillId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(5);
  });

  it("rejects level 0 (below minimum)", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 0 });

    expect(res.status).toBe(400);
  });

  it("rejects level 6 (above maximum)", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: 6 });

    expect(res.status).toBe(400);
  });

  it("rejects negative level", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId, level: -1 });

    expect(res.status).toBe(400);
  });

  it("returns 400 when skill_id is missing", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ level: 3 });

    expect(res.status).toBe(400);
  });

  it("returns 400 when level is missing", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillId });

    expect(res.status).toBe(400);
  });

  it("returns 404 for skill not in team", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: 999999, level: 3 });

    expect(res.status).toBe(404);
  });

  it("admin gets 404 when setting proficiency for user not in team", async () => {
    const otherTeam = await createTestTeam("Foreign Team");
    const foreignMember = await createTestMember(otherTeam.token);

    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: skillId, level: 3, user_id: foreignMember.user.id });

    expect(res.status).toBe(404);
  });

  it("saves notes when provided", async () => {
    // Create a second skill to avoid conflicts
    const skillRes = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "NotesSkill", domain: "tools" });

    const res = await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: skillRes.body.id, level: 3, notes: "Learning in progress" });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBe("Learning in progress");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request()
      .post("/api/proficiencies")
      .send({ skill_id: skillId, level: 3 });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/proficiencies/:user_id/:skill_id", () => {
  let deleteSkillId;

  beforeEach(async () => {
    // Create a fresh skill and proficiency for each delete test
    const skillRes = await request()
      .post("/api/skills")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: `DelSkill-${Date.now()}`, domain: "tools" });
    deleteSkillId = skillRes.body.id;
  });

  it("member can delete own proficiency", async () => {
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: deleteSkillId, level: 3 });

    const res = await request()
      .delete(`/api/proficiencies/${member.user.id}/${deleteSkillId}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(204);

    // Verify deleted
    const { rows } = await query(
      "SELECT * FROM proficiencies WHERE user_id = $1 AND skill_id = $2",
      [member.user.id, deleteSkillId]
    );
    expect(rows).toHaveLength(0);
  });

  it("admin can delete anyone's proficiency", async () => {
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ skill_id: deleteSkillId, level: 3 });

    const res = await request()
      .delete(`/api/proficiencies/${member.user.id}/${deleteSkillId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });

  it("member cannot delete another user's proficiency (403)", async () => {
    await request()
      .post("/api/proficiencies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ skill_id: deleteSkillId, level: 4 });

    const res = await request()
      .delete(`/api/proficiencies/${admin.user.id}/${deleteSkillId}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it("returns 204 even if proficiency does not exist (idempotent)", async () => {
    const res = await request()
      .delete(`/api/proficiencies/${member.user.id}/999999`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(204);
  });
});
