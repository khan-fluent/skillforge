import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";
import { query } from "../db/index.js";

let admin, member, teamB;

beforeAll(async () => {
  const team = await createTestTeam("Chat Test Team");
  admin = team;
  member = await createTestMember(admin.token);
  teamB = await createTestTeam("Chat Team B");
});

afterAll(async () => {
  await cleanupTestData();
});

describe("POST /api/chat/sessions", () => {
  it("creates a session with a title", async () => {
    const res = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "My Session" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("My Session");
    expect(res.body.user_id).toBe(admin.user.id);
    expect(res.body.id).toBeDefined();
  });

  it("defaults title to 'New conversation'", async () => {
    const res = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New conversation");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request()
      .post("/api/chat/sessions")
      .send({ title: "No Auth" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/chat/sessions", () => {
  it("lists sessions for the current user", async () => {
    // Create sessions for admin and member
    await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Session" });

    await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Member Session" });

    const res = await request()
      .get("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Admin should only see their own sessions
    const titles = res.body.map((s) => s.title);
    expect(titles).toContain("Admin Session");
    expect(titles).not.toContain("Member Session");
  });

  it("includes message_count", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Counted Session" });

    const sessionId = sessionRes.body.id;

    // Insert messages directly via DB
    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', 'hello')", [sessionId]);
    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'assistant', 'hi there')", [sessionId]);

    const res = await request()
      .get("/api/chat/sessions")
      .set("Authorization", `Bearer ${member.token}`);

    const session = res.body.find((s) => s.id === sessionId);
    expect(session).toBeDefined();
    expect(session.message_count).toBe(2);
  });
});

describe("GET /api/chat/sessions/:id", () => {
  it("returns a session with its messages", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Detail Session" });

    const sessionId = sessionRes.body.id;

    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', 'What skills are at risk?')", [sessionId]);
    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'assistant', 'Based on the data...')", [sessionId]);
    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', 'Tell me more')", [sessionId]);

    const res = await request()
      .get(`/api/chat/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Detail Session");
    expect(res.body.messages).toHaveLength(3);
    expect(res.body.messages[0].role).toBe("user");
    expect(res.body.messages[0].content).toBe("What skills are at risk?");
    expect(res.body.messages[1].role).toBe("assistant");
  });

  it("returns 404 for non-existent session", async () => {
    const res = await request()
      .get("/api/chat/sessions/999999")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/chat/sessions/:id", () => {
  it("renames a session", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Old Title" });

    const res = await request()
      .put(`/api/chat/sessions/${sessionRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "New Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
  });

  it("returns 404 for another user's session", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Only" });

    const res = await request()
      .put(`/api/chat/sessions/${sessionRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Hijacked" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/chat/sessions/:id", () => {
  it("deletes a session and its messages", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "To Delete" });

    const sessionId = sessionRes.body.id;
    await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', 'bye')", [sessionId]);

    const delRes = await request()
      .delete(`/api/chat/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(delRes.status).toBe(204);

    // Verify session is gone
    const getRes = await request()
      .get(`/api/chat/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(getRes.status).toBe(404);

    // Verify messages cascaded
    const { rows } = await query("SELECT * FROM chat_messages WHERE session_id = $1", [sessionId]);
    expect(rows).toHaveLength(0);
  });

  it("silently succeeds for non-existent session", async () => {
    const res = await request()
      .delete("/api/chat/sessions/999999")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });
});

describe("Session ownership isolation", () => {
  it("user A cannot GET user B's session", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Private Session" });

    const res = await request()
      .get(`/api/chat/sessions/${sessionRes.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(404);
  });

  it("user A cannot rename user B's session", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Member Private" });

    const res = await request()
      .put(`/api/chat/sessions/${sessionRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Stolen" });

    expect(res.status).toBe(404);
  });

  it("cross-team user cannot access session", async () => {
    const sessionRes = await request()
      .post("/api/chat/sessions")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Team A Only" });

    const res = await request()
      .get(`/api/chat/sessions/${sessionRes.body.id}`)
      .set("Authorization", `Bearer ${teamB.token}`);

    expect(res.status).toBe(404);
  });
});
