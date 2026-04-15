import { request, cleanupTestData } from "./helpers.js";

describe("GET /api/health", () => {
  afterAll(() => cleanupTestData());

  it("returns status ok with db ok (no auth required)", async () => {
    const res = await request().get("/api/health").expect(200);

    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });
});
