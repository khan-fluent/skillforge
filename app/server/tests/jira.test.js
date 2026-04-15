import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";
import { query } from "../db/index.js";

let admin, member;

beforeAll(async () => {
  admin = await createTestTeam("Jira Team");
  member = await createTestMember(admin.token);
});

afterAll(async () => {
  await cleanupTestData();
});

// ─── Connection ─────────────────────────────────────────────────────────────

describe("POST /api/jira/connection", () => {
  it("admin creates a connection", async () => {
    const res = await request()
      .post("/api/jira/connection")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        base_url: "https://test.atlassian.net",
        email: "admin@test.com",
        api_token: "my-secret-jira-token",
      });

    expect(res.status).toBe(200);
    expect(res.body.base_url).toBe("https://test.atlassian.net");
    expect(res.body.email).toBe("admin@test.com");
    // Should NOT return the api_token
    expect(res.body.api_token).toBeUndefined();
  });

  it("returns 400 when fields are missing", async () => {
    const res = await request()
      .post("/api/jira/connection")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ base_url: "https://x.atlassian.net" });

    expect(res.status).toBe(400);
  });

  it("stores api_token encrypted in DB (not plaintext)", async () => {
    // Connection was already created above; read raw DB value
    const { rows } = await query(
      "SELECT api_token FROM jira_connections WHERE team_id = $1",
      [admin.team.id]
    );
    expect(rows).toHaveLength(1);
    const rawToken = rows[0].api_token;

    // Raw value must NOT equal the plaintext token
    expect(rawToken).not.toBe("my-secret-jira-token");
    // It should be a base64 string (output of encrypt())
    expect(rawToken).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe("GET /api/jira/connection", () => {
  it("returns connection info without api_token", async () => {
    const res = await request()
      .get("/api/jira/connection")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.base_url).toBe("https://test.atlassian.net");
    expect(res.body.api_token).toBeUndefined();
  });

  it("returns { connected: false } when no connection exists", async () => {
    // Use member from same team but delete connection first, then recreate
    const other = await createTestTeam("No Jira Team");
    const res = await request()
      .get("/api/jira/connection")
      .set("Authorization", `Bearer ${other.token}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });
});

describe("DELETE /api/jira/connection", () => {
  it("removes the connection", async () => {
    // Create a fresh team so we don't break other tests
    const tmp = await createTestTeam("Jira Delete Team");
    await request()
      .post("/api/jira/connection")
      .set("Authorization", `Bearer ${tmp.token}`)
      .send({
        base_url: "https://del.atlassian.net",
        email: "del@test.com",
        api_token: "delete-me-token",
      });

    const del = await request()
      .delete("/api/jira/connection")
      .set("Authorization", `Bearer ${tmp.token}`);
    expect(del.status).toBe(204);

    const get = await request()
      .get("/api/jira/connection")
      .set("Authorization", `Bearer ${tmp.token}`);
    expect(get.body.connected).toBe(false);
  });
});

// ─── Filters ────────────────────────────────────────────────────────────────

describe("POST /api/jira/filters", () => {
  it("admin creates a JQL filter", async () => {
    const res = await request()
      .post("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Sprint bugs", jql: "type = Bug AND sprint in openSprints()" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sprint bugs");
    expect(res.body.jql).toBe("type = Bug AND sprint in openSprints()");
  });

  it("returns 400 when name or jql missing", async () => {
    const res = await request()
      .post("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "No JQL" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/jira/filters", () => {
  it("lists filters for the team", async () => {
    const res = await request()
      .get("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // At least the one we created + the default seeded on connection creation
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe("DELETE /api/jira/filters/:id", () => {
  it("deletes a filter", async () => {
    const create = await request()
      .post("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Temp Filter", jql: "project = TEMP" });

    const del = await request()
      .delete(`/api/jira/filters/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(del.status).toBe(204);

    // Verify it's gone
    const list = await request()
      .get("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`);
    const ids = list.body.map((f) => f.id);
    expect(ids).not.toContain(create.body.id);
  });
});

// ─── Non-admin 403 ──────────────────────────────────────────────────────────

describe("Non-admin gets 403 on write operations", () => {
  it("member cannot create connection", async () => {
    const res = await request()
      .post("/api/jira/connection")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        base_url: "https://hack.atlassian.net",
        email: "hack@test.com",
        api_token: "nope",
      });
    expect(res.status).toBe(403);
  });

  it("member cannot delete connection", async () => {
    const res = await request()
      .delete("/api/jira/connection")
      .set("Authorization", `Bearer ${member.token}`);
    expect(res.status).toBe(403);
  });

  it("member cannot create filter", async () => {
    const res = await request()
      .post("/api/jira/filters")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Hack", jql: "project = HACK" });
    expect(res.status).toBe(403);
  });

  it("member cannot delete filter", async () => {
    const list = await request()
      .get("/api/jira/filters")
      .set("Authorization", `Bearer ${admin.token}`);
    if (list.body.length > 0) {
      const res = await request()
        .delete(`/api/jira/filters/${list.body[0].id}`)
        .set("Authorization", `Bearer ${member.token}`);
      expect(res.status).toBe(403);
    }
  });
});

// ─── Encryption verification ────────────────────────────────────────────────

describe("Token encryption verification", () => {
  it("raw DB value is not the plaintext token", async () => {
    const { rows } = await query(
      "SELECT api_token FROM jira_connections WHERE team_id = $1",
      [admin.team.id]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].api_token).not.toBe("my-secret-jira-token");
  });
});
