import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

import { createApp } from "./app.js";
import pool from "./db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = createApp();
const PORT = process.env.PORT || 3003;

if (process.env.NODE_ENV === "production") {
  const clientDist = join(__dirname, "public");
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

// Self-bootstrap our database against the shared khan-fluent RDS instance.
async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || "skillforge";
  const adminPool = new pg.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: "postgres",
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : false,
  });
  try {
    const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }
  } finally {
    await adminPool.end();
  }
}

async function start() {
  try {
    await ensureDatabaseExists();
    await pool.query("SELECT 1");
    console.log("Database connected");

    const schema = readFileSync(join(__dirname, "db", "schema.sql"), "utf-8");
    await pool.query(schema);
    console.log("Schema initialized");
  } catch (err) {
    console.error("Database setup failed:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Skillforge running on port ${PORT}`);
  });
}

const shutdown = async (sig) => {
  console.log(`${sig} received, shutting down...`);
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
