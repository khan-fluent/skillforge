import { request, createTestTeam, cleanupTestData } from "./helpers.js";
import { query } from "../db/index.js";

describe("Auth routes", () => {
  let team, admin, adminToken;

  beforeAll(async () => {
    const t = await createTestTeam("AuthTestTeam");
    team = t.team;
    admin = t.user;
    adminToken = t.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/signup
  // -------------------------------------------------------------------------
  describe("POST /api/auth/signup", () => {
    it("creates a new team and admin user", async () => {
      const res = await request()
        .post("/api/auth/signup")
        .send({
          team_name: "Brand New Team",
          name: "New Admin",
          email: `signup-${Date.now()}@test.com`,
          password: "strongpass99",
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe("admin");
      expect(res.body.user.name).toBe("New Admin");
      expect(res.body.team.name).toBe("Brand New Team");
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request()
        .post("/api/auth/signup")
        .send({ team_name: "Incomplete" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 400 when password is too short", async () => {
      const res = await request()
        .post("/api/auth/signup")
        .send({
          team_name: "Short PW Team",
          name: "User",
          email: `shortpw-${Date.now()}@test.com`,
          password: "abc",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });

    it("returns 409 for duplicate email", async () => {
      const email = `dup-${Date.now()}@test.com`;
      await request()
        .post("/api/auth/signup")
        .send({ team_name: "First", name: "First", email, password: "password123" });

      const res = await request()
        .post("/api/auth/signup")
        .send({ team_name: "Second", name: "Second", email, password: "password123" });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already/i);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------
  describe("POST /api/auth/login", () => {
    let loginEmail;

    beforeAll(async () => {
      loginEmail = `login-${Date.now()}@test.com`;
      await request()
        .post("/api/auth/signup")
        .send({ team_name: "LoginTeam", name: "LoginUser", email: loginEmail, password: "password123" });
    });

    it("logs in with correct credentials", async () => {
      const res = await request()
        .post("/api/auth/login")
        .send({ email: loginEmail, password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(loginEmail);
    });

    it("returns 401 for wrong password", async () => {
      const res = await request()
        .post("/api/auth/login")
        .send({ email: loginEmail, password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it("returns 401 for non-existent email", async () => {
      const res = await request()
        .post("/api/auth/login")
        .send({ email: "nobody@nowhere.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/accept
  // -------------------------------------------------------------------------
  describe("POST /api/auth/accept", () => {
    let inviteToken;
    let invitedUserId;

    beforeAll(async () => {
      // Create an invited member via admin
      const inviteRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Invitee", email: `invitee-${Date.now()}@test.com` });

      inviteToken = inviteRes.body.invite_token;
      invitedUserId = inviteRes.body.id;
    });

    it("accepts a valid invite and sets password", async () => {
      const res = await request()
        .post("/api/auth/accept")
        .send({ token: inviteToken, password: "newpassword1" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.accepted_at).toBeDefined();
    });

    it("returns 404 for invalid token", async () => {
      const res = await request()
        .post("/api/auth/accept")
        .send({ token: "nonexistenttoken123", password: "password123" });

      expect(res.status).toBe(404);
    });

    it("returns 410 for expired invite", async () => {
      // Create a new invite then expire it via direct DB
      const inviteRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Expired Invitee", email: `expired-${Date.now()}@test.com` });

      const expiredToken = inviteRes.body.invite_token;
      await query(
        "UPDATE users SET invite_expires_at = NOW() - INTERVAL '1 day' WHERE invite_token = $1",
        [expiredToken]
      );

      const res = await request()
        .post("/api/auth/accept")
        .send({ token: expiredToken, password: "password123" });

      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/expired/i);
    });

    it("returns 400 for short password", async () => {
      const inviteRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Short PW", email: `shortpw-accept-${Date.now()}@test.com` });

      const res = await request()
        .post("/api/auth/accept")
        .send({ token: inviteRes.body.invite_token, password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/invite/:token
  // -------------------------------------------------------------------------
  describe("GET /api/auth/invite/:token", () => {
    it("returns invite details for a valid token", async () => {
      const inviteRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Lookup Invitee", email: `lookup-${Date.now()}@test.com` });

      const res = await request()
        .get(`/api/auth/invite/${inviteRes.body.invite_token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Lookup Invitee");
      expect(res.body.team_name).toBe("AuthTestTeam");
    });

    it("returns 404 for unknown token", async () => {
      const res = await request().get("/api/auth/invite/bogustoken999");

      expect(res.status).toBe(404);
    });

    it("returns 410 for expired invite", async () => {
      const inviteRes = await request()
        .post("/api/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Expired Lookup", email: `expired-lookup-${Date.now()}@test.com` });

      await query(
        "UPDATE users SET invite_expires_at = NOW() - INTERVAL '1 day' WHERE invite_token = $1",
        [inviteRes.body.invite_token]
      );

      const res = await request()
        .get(`/api/auth/invite/${inviteRes.body.invite_token}`);

      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------
  describe("GET /api/auth/me", () => {
    it("returns the current user and team", async () => {
      const res = await request()
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(admin.id);
      expect(res.body.team).toBeDefined();
      expect(res.body.team.name).toBe("AuthTestTeam");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/providers
  // -------------------------------------------------------------------------
  describe("GET /api/auth/providers", () => {
    it("returns auth method configuration", async () => {
      const res = await request().get("/api/auth/providers");

      expect(res.status).toBe(200);
      expect(res.body.method).toBeDefined();
      expect(typeof res.body.local).toBe("boolean");
      expect(typeof res.body.sso).toBe("boolean");
    });
  });

  // -------------------------------------------------------------------------
  // Unauthenticated access to protected endpoints
  // -------------------------------------------------------------------------
  describe("Unauthenticated requests", () => {
    it("GET /api/auth/me returns 401 without token", async () => {
      const res = await request().get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("GET /api/members returns 401 without token", async () => {
      const res = await request().get("/api/members");
      expect(res.status).toBe(401);
    });

    it("POST /api/members returns 401 without token", async () => {
      const res = await request()
        .post("/api/members")
        .send({ name: "Hacker", email: "hacker@evil.com" });
      expect(res.status).toBe(401);
    });
  });
});
