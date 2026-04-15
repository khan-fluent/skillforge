import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { beforeAll, afterAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Override env before anything else imports db/index.js
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_NAME = process.env.TEST_DB_NAME || "skillforge_test";
process.env.DB_USERNAME = process.env.DB_USERNAME || "skillforge";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "skillforge";
process.env.JWT_SECRET = "test-jwt-secret-not-for-production";
process.env.ENCRYPTION_KEY = "a]b@c#d$e%f^g&h*i(j)k-l_m+n=o.p!q~r[s{t}u|v0000";
// Valid 64-char hex key for tests
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let adminPool;

beforeAll(async () => {
  const dbName = process.env.DB_NAME;

  // Create the test database if it doesn't exist
  adminPool = new pg.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: "postgres",
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rows.length === 0) {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  }
  await adminPool.end();

  // Now connect to the test DB and run schema
  const { default: pool } = await import("../db/index.js");
  const schemaPath = join(__dirname, "..", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  await pool.query(schema);
});

afterAll(async () => {
  const { default: pool } = await import("../db/index.js");
  await pool.end();
});
