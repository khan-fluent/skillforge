import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";

describe("routes/team", () => {
  let admin, member;

  beforeAll(async () => {
    admin = await createTestTeam("Team Routes Test");
    member = await createTestMember(admin.token);
  });

  afterAll(() => cleanupTestData());

  describe("GET /api/team", () => {
    it("returns team info for authenticated user", async () => {
      const res = await request()
        .get("/api/team")
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: admin.team.id,
        name: "Team Routes Test",
      });
      expect(res.body.created_at).toBeDefined();
    });
  });

  describe("PUT /api/team", () => {
    it("allows admin to rename the team", async () => {
      const res = await request()
        .put("/api/team")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "Renamed Team" })
        .expect(200);

      expect(res.body.name).toBe("Renamed Team");
      expect(res.body.id).toBe(admin.team.id);
    });

    it("rejects member with 403", async () => {
      await request()
        .put("/api/team")
        .set("Authorization", `Bearer ${member.token}`)
        .send({ name: "Nope" })
        .expect(403);
    });

    it("rejects missing name with 400", async () => {
      await request()
        .put("/api/team")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({})
        .expect(400);
    });
  });
});
