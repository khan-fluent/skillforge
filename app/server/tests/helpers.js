import supertest from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import pool, { query } from "../db/index.js";

// Shared app instance — rate limits skipped for tests
let _app;
export function getApp() {
  if (!_app) _app = createApp({ skipRateLimits: true });
  return _app;
}

export function request() {
  return supertest(getApp());
}

// Create a team + admin user, return { team, user, token }
export async function createTestTeam(name = "Test Team") {
  const res = await request()
    .post("/api/auth/signup")
    .send({
      team_name: name,
      name: `Admin ${Date.now()}`,
      email: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: "testpassword123",
    });
  return {
    team: res.body.team,
    user: res.body.user,
    token: res.body.token,
  };
}

// Create a member (via admin invite + accept), return { user, token }
export async function createTestMember(adminToken, opts = {}) {
  const email = opts.email || `member-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const inviteRes = await request()
    .post("/api/members")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: opts.name || "Test Member", email, role: opts.role || "member" });

  const inviteToken = inviteRes.body.invite_token;
  const acceptRes = await request()
    .post("/api/auth/accept")
    .send({ token: inviteToken, password: "testpassword123" });

  return { user: acceptRes.body.user, token: acceptRes.body.token };
}

// Clean up all test data — call in afterEach or afterAll
export async function cleanupTestData() {
  await query("DELETE FROM chat_messages");
  await query("DELETE FROM chat_sessions");
  await query("DELETE FROM upskill_steps");
  await query("DELETE FROM upskill_plans");
  await query("DELETE FROM kb_document_skills");
  await query("DELETE FROM kb_documents");
  await query("DELETE FROM kb_folders");
  await query("DELETE FROM jira_issues");
  await query("DELETE FROM jira_filters");
  await query("DELETE FROM jira_connections");
  await query("DELETE FROM domain_proficiencies");
  await query("DELETE FROM domains");
  await query("DELETE FROM certifications");
  await query("DELETE FROM proficiencies");
  await query("DELETE FROM skills");
  await query("DELETE FROM users");
  await query("DELETE FROM teams");
}
