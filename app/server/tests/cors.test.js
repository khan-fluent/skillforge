import { createApp } from "../app.js";
import supertest from "supertest";

describe("CORS configuration", () => {
  describe("when CORS_ALLOWED_ORIGINS is unset", () => {
    let app;

    beforeAll(() => {
      delete process.env.CORS_ALLOWED_ORIGINS;
      app = createApp({ skipRateLimits: true });
    });

    it("allows requests from any origin", async () => {
      const res = await supertest(app)
        .get("/api/health")
        .set("Origin", "https://random-origin.example.com");

      expect(res.status).not.toBe(403);
    });
  });

  describe("when CORS_ALLOWED_ORIGINS is set", () => {
    let app;
    const allowed = "https://allowed.example.com";

    beforeAll(() => {
      process.env.CORS_ALLOWED_ORIGINS = allowed;
      app = createApp({ skipRateLimits: true });
    });

    afterAll(() => {
      delete process.env.CORS_ALLOWED_ORIGINS;
    });

    it("allows requests from the allowed origin", async () => {
      const res = await supertest(app)
        .get("/api/health")
        .set("Origin", allowed);

      expect(res.status).not.toBe(403);
    });

    it("rejects requests from a disallowed origin with 403", async () => {
      const res = await supertest(app)
        .get("/api/health")
        .set("Origin", "https://evil.example.com");

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Origin not allowed");
    });

    it("allows requests with no origin (server-to-server)", async () => {
      const res = await supertest(app).get("/api/health");

      expect(res.status).not.toBe(403);
    });
  });
});
