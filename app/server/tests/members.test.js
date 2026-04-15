import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";
import { query } from "../db/index.js";

describe("Members routes", () => {
  let team, admin, adminToken;
  let member, memberToken;

  beforeAll(async () => {
    const t = await createTestTeam("MembersTestTeam");
    team = t.team;
    admin = t.user;
    adminToken = t.token;

    const m = await createTestMember(adminToken, { name: "Regular Member" });
    member = m.user;
    memberToken = m.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // -------------------------------------------------------------------------
  // GET /api/members
  // -------------------------------------------------------------------------
  describe("GET /api/members", () => {
    it("lists team members with skill stats", async () => {
      const res = await request()
        .get("/api/members")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2); // admin + member

      const first = res.body[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("email");
      expect(first).toHaveProperty("role");
      expect(first).toHaveProperty("skill_count");
      expect(first).toHaveProperty("avg_level");
    });

    it("is accessible by non-admin members", async () => {
      const res = await request()
        .get("/api/members")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/members/:id
  // -------------------------------------------------------------------------
  describe("GET /api/members/:id", () => {
    it("returns member detail with skills and certifications", async () => {
      const res = await request()
        .get(`/api/members/${member.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(member.id);
      expect(res.body.name).toBe("Regular Member");
      expect(res.body).toHaveProperty("skills");
      expect(Array.isArray(res.body.skills)).toBe(true);
      expect(res.body).toHaveProperty("certifications");
      expect(Array.isArray(res.body.certifications)).toBe(true);
    });

    it("returns 404 for non-existent member", async () => {
      const res = await request()
        .get("/api/members/999999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/members
  // -------------------------------------------------------------------------
  describe("POST /api/members", () => {
    it("admin creates a member with invite token", async () => {
      const email = `new-member-${Date.now()}@test.com`;
      const res = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New Hire", email, role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("New Hire");
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe("member");
      expect(res.body.invite_token).toBeDefined();
      expect(res.body.invite_expires_at).toBeDefined();
    });

    it("non-admin gets 403", async () => {
      const res = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Sneaky", email: `sneaky-${Date.now()}@test.com` });

      expect(res.status).toBe(403);
    });

    it("duplicate email returns 409", async () => {
      const email = `dup-member-${Date.now()}@test.com`;
      await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "First", email });

      const res = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Second", email });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already/i);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/members/:id
  // -------------------------------------------------------------------------
  describe("PUT /api/members/:id", () => {
    it("admin can edit any member", async () => {
      const res = await request()
        .put(`/api/members/${member.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ job_title: "Senior Engineer" });

      expect(res.status).toBe(200);
      expect(res.body.job_title).toBe("Senior Engineer");
    });

    it("member can edit self", async () => {
      const res = await request()
        .put(`/api/members/${member.id}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    it("member cannot edit others", async () => {
      const res = await request()
        .put(`/api/members/${admin.id}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Hacked Admin" });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/members/:id
  // -------------------------------------------------------------------------
  describe("DELETE /api/members/:id", () => {
    it("admin can delete a member", async () => {
      // Create a throwaway member to delete
      const m = await createTestMember(adminToken, { name: "Doomed Member" });

      const res = await request()
        .delete(`/api/members/${m.user.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const check = await request()
        .get(`/api/members/${m.user.id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(check.status).toBe(404);
    });

    it("admin cannot delete self", async () => {
      const res = await request()
        .delete(`/api/members/${admin.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete themselves/i);
    });

    it("non-admin gets 403", async () => {
      const res = await request()
        .delete(`/api/members/${admin.id}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/members/:id/reinvite
  // -------------------------------------------------------------------------
  describe("POST /api/members/:id/reinvite", () => {
    it("admin can reissue an invite with new token and expiry", async () => {
      // Create a member to reinvite
      const email = `reinvite-${Date.now()}@test.com`;
      const createRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Reinvitee", email });

      const originalToken = createRes.body.invite_token;

      const res = await request()
        .post(`/api/members/${createRes.body.id}/reinvite`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invite_token).toBeDefined();
      expect(res.body.invite_token).not.toBe(originalToken);
      expect(res.body.invite_expires_at).toBeDefined();
    });

    it("non-admin gets 403", async () => {
      const res = await request()
        .post(`/api/members/${member.id}/reinvite`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });
});
