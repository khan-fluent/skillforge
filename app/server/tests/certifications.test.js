import { request, createTestTeam, createTestMember, cleanupTestData } from "./helpers.js";

let admin, member, otherMember;

beforeAll(async () => {
  admin = await createTestTeam("Cert Test Team");
  member = await createTestMember(admin.token);
  otherMember = await createTestMember(admin.token, { name: "Other Member" });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("GET /api/certifications", () => {
  it("returns empty array when no certs exist", async () => {
    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns certs with 'valid' status for future expiry", async () => {
    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "AWS SAA", issuer: "Amazon", expires_on: "2028-01-01" });

    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);

    const cert = res.body.find((c) => c.name === "AWS SAA");
    expect(cert).toBeDefined();
    expect(cert.status).toBe("valid");
    expect(cert.person_name).toBeDefined();
  });

  it("returns 'expired' status for past expiry", async () => {
    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Expired Cert", expires_on: "2020-01-01" });

    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);

    const cert = res.body.find((c) => c.name === "Expired Cert");
    expect(cert.status).toBe("expired");
  });

  it("returns 'expiring_soon' status for expiry within 90 days", async () => {
    // Compute a date 30 days from now
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const soonStr = soon.toISOString().slice(0, 10);

    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Expiring Soon Cert", expires_on: soonStr });

    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);

    const cert = res.body.find((c) => c.name === "Expiring Soon Cert");
    expect(cert.status).toBe("expiring_soon");
  });

  it("returns 'no_expiry' status when expires_on is null", async () => {
    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "No Expiry Cert" });

    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);

    const cert = res.body.find((c) => c.name === "No Expiry Cert");
    expect(cert.status).toBe("no_expiry");
  });

  it("does not return certs from another team", async () => {
    const other = await createTestTeam("Other Cert Team");
    await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ name: "Foreign Cert" });

    const res = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);

    const found = res.body.find((c) => c.name === "Foreign Cert");
    expect(found).toBeUndefined();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request().get("/api/certifications");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/certifications", () => {
  it("member creates own certification", async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        name: "CKA",
        issuer: "CNCF",
        issued_on: "2025-06-01",
        expires_on: "2028-06-01",
        credential_url: "https://certs.example.com/cka",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("CKA");
    expect(res.body.issuer).toBe("CNCF");
    expect(res.body.user_id).toBe(member.user.id);
    expect(res.body.credential_url).toBe("https://certs.example.com/cka");
  });

  it("admin can create cert for another user via user_id", async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Admin Created Cert", user_id: otherMember.user.id });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(otherMember.user.id);
  });

  it("member cannot create cert for another user (403)", async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Forbidden Cert", user_id: otherMember.user.id });

    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ issuer: "Some Issuer" });

    expect(res.status).toBe(400);
  });

  it("admin gets 404 for user not in team", async () => {
    const otherTeam = await createTestTeam("Foreign Cert Team");
    const foreignMember = await createTestMember(otherTeam.token);

    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Cross Team Cert", user_id: foreignMember.user.id });

    expect(res.status).toBe(404);
  });

  it("creates cert with minimal fields (name only)", async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Minimal Cert" });

    expect(res.status).toBe(201);
    expect(res.body.issuer).toBeNull();
    expect(res.body.issued_on).toBeNull();
    expect(res.body.expires_on).toBeNull();
    expect(res.body.credential_url).toBeNull();
  });
});

describe("PUT /api/certifications/:id", () => {
  let ownCertId;

  beforeEach(async () => {
    const res = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Editable Cert", issuer: "Original Issuer" });
    ownCertId = res.body.id;
  });

  it("owner can edit their own cert", async () => {
    const res = await request()
      .put(`/api/certifications/${ownCertId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Renamed Cert", issuer: "New Issuer" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Cert");
    expect(res.body.issuer).toBe("New Issuer");
  });

  it("admin can edit any team member's cert", async () => {
    const res = await request()
      .put(`/api/certifications/${ownCertId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ issuer: "Admin Updated" });

    expect(res.status).toBe(200);
    expect(res.body.issuer).toBe("Admin Updated");
  });

  it("other member gets 403", async () => {
    const res = await request()
      .put(`/api/certifications/${ownCertId}`)
      .set("Authorization", `Bearer ${otherMember.token}`)
      .send({ name: "Hacked Cert" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent cert", async () => {
    const res = await request()
      .put("/api/certifications/999999")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
  });

  it("partial update preserves other fields", async () => {
    const res = await request()
      .put(`/api/certifications/${ownCertId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ credential_url: "https://new.url" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Editable Cert"); // unchanged
    expect(res.body.issuer).toBe("Original Issuer"); // unchanged
    expect(res.body.credential_url).toBe("https://new.url");
  });
});

describe("DELETE /api/certifications/:id", () => {
  it("owner can delete their own cert", async () => {
    const create = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Delete Me Cert" });

    const res = await request()
      .delete(`/api/certifications/${create.body.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const list = await request()
      .get("/api/certifications")
      .set("Authorization", `Bearer ${admin.token}`);
    const found = list.body.find((c) => c.id === create.body.id);
    expect(found).toBeUndefined();
  });

  it("admin can delete any team member's cert", async () => {
    const create = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Admin Deletes This" });

    const res = await request()
      .delete(`/api/certifications/${create.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });

  it("other member gets 403", async () => {
    const create = await request()
      .post("/api/certifications")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Protected Cert" });

    const res = await request()
      .delete(`/api/certifications/${create.body.id}`)
      .set("Authorization", `Bearer ${otherMember.token}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent cert", async () => {
    const res = await request()
      .delete("/api/certifications/999999")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});
