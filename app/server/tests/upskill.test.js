import { request, createTestTeam, createTestMember, cleanupTestData } from "../tests/helpers.js";

let admin, member;

beforeAll(async () => {
  admin = await createTestTeam("Upskill Team");
  member = await createTestMember(admin.token);
});

afterAll(async () => {
  await cleanupTestData();
});

// ─── Plan CRUD ──────────────────────────────────────────────────────────────

describe("POST /api/upskill", () => {
  it("creates a plan with title only", async () => {
    const res = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Learn Docker" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Learn Docker");
    expect(res.body.user_id).toBe(admin.user.id);
  });

  it("creates a plan with steps", async () => {
    const res = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Learn K8s",
        steps: [
          { title: "Install minikube", description: "Local cluster setup" },
          { title: "Deploy a pod" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Learn K8s");

    // Verify steps were created
    const get = await request()
      .get(`/api/upskill/${res.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(get.body.steps).toHaveLength(2);
    expect(get.body.steps[0].title).toBe("Install minikube");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });
});

describe("GET /api/upskill", () => {
  let adminPlanId, memberPlanId;

  beforeAll(async () => {
    const a = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Plan" });
    adminPlanId = a.body.id;

    const m = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Member Plan" });
    memberPlanId = m.body.id;
  });

  it("admin sees all plans", async () => {
    const res = await request()
      .get("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).toContain(adminPlanId);
    expect(ids).toContain(memberPlanId);
  });

  it("member sees only own plans", async () => {
    const res = await request()
      .get("/api/upskill")
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).toContain(memberPlanId);
    expect(ids).not.toContain(adminPlanId);
  });
});

describe("GET /api/upskill/:id", () => {
  it("returns plan with steps", async () => {
    const create = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "With Steps",
        steps: [{ title: "Step A" }, { title: "Step B" }],
      });

    const res = await request()
      .get(`/api/upskill/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("With Steps");
    expect(res.body.steps).toHaveLength(2);
  });

  it("returns 404 for non-existent plan", async () => {
    const res = await request()
      .get("/api/upskill/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/upskill/:id", () => {
  it("updates plan title, summary, and status", async () => {
    const create = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Original" });

    const res = await request()
      .put(`/api/upskill/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Updated", summary: "A summary", status: "completed" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
    expect(res.body.summary).toBe("A summary");
    expect(res.body.status).toBe("completed");
  });

  it("member can only edit own plan", async () => {
    const adminPlan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Only" });

    const res = await request()
      .put(`/api/upskill/${adminPlan.body.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Hijacked" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/upskill/:id", () => {
  it("deletes a plan", async () => {
    const create = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "To Delete" });

    const res = await request()
      .delete(`/api/upskill/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);

    const get = await request()
      .get(`/api/upskill/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(get.status).toBe(404);
  });

  it("member cannot delete admin's plan", async () => {
    const adminPlan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Owned" });

    await request()
      .delete(`/api/upskill/${adminPlan.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    // Plan should still exist for admin
    const get = await request()
      .get(`/api/upskill/${adminPlan.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(get.status).toBe(200);
  });
});

// ─── Step CRUD ──────────────────────────────────────────────────────────────

describe("POST /api/upskill/:planId/steps", () => {
  it("adds a step to a plan", async () => {
    const plan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Step Plan" });

    const res = await request()
      .post(`/api/upskill/${plan.body.id}/steps`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "New Step", description: "Do this" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New Step");
    expect(res.body.plan_id).toBe(plan.body.id);
  });

  it("returns 400 when step title is missing", async () => {
    const plan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Step Plan 2" });

    const res = await request()
      .post(`/api/upskill/${plan.body.id}/steps`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/upskill/steps/:id", () => {
  it("toggles step completed and edits title", async () => {
    const plan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Toggle Plan", steps: [{ title: "Step 1" }] });

    const get = await request()
      .get(`/api/upskill/${plan.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const stepId = get.body.steps[0].id;

    const res = await request()
      .put(`/api/upskill/steps/${stepId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Renamed Step", completed: true });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Renamed Step");
    expect(res.body.completed).toBe(true);
    expect(res.body.completed_at).toBeTruthy();
  });
});

describe("DELETE /api/upskill/steps/:id", () => {
  it("deletes a step", async () => {
    const plan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Delete Step Plan", steps: [{ title: "Doomed Step" }] });

    const get = await request()
      .get(`/api/upskill/${plan.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const stepId = get.body.steps[0].id;

    const res = await request()
      .delete(`/api/upskill/steps/${stepId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);

    const after = await request()
      .get(`/api/upskill/${plan.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(after.body.steps).toHaveLength(0);
  });
});

// ─── Permissions ────────────────────────────────────────────────────────────

describe("Step permission checks", () => {
  it("member cannot access steps on admin's plan", async () => {
    const plan = await request()
      .post("/api/upskill")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Secret Plan", steps: [{ title: "Secret Step" }] });

    const get = await request()
      .get(`/api/upskill/${plan.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const stepId = get.body.steps[0].id;

    // Member cannot add step to admin's plan
    const addRes = await request()
      .post(`/api/upskill/${plan.body.id}/steps`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Intruder Step" });
    expect(addRes.status).toBe(403);

    // Member cannot update admin's step
    const updateRes = await request()
      .put(`/api/upskill/steps/${stepId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ completed: true });
    expect(updateRes.status).toBe(403);

    // Member cannot delete admin's step
    const deleteRes = await request()
      .delete(`/api/upskill/steps/${stepId}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(deleteRes.status).toBe(403);
  });
});
