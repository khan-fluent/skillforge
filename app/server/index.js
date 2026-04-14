import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

import { apiLimiter, authLimiter, aiLimiter } from "./middleware/rateLimiter.js";
import pool from "./db/index.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import teamRouter from "./routes/team.js";
import membersRouter from "./routes/members.js";
import skillsRouter from "./routes/skills.js";
import proficienciesRouter from "./routes/proficiencies.js";
import certificationsRouter from "./routes/certifications.js";
import matrixRouter from "./routes/matrix.js";
import gapsRouter from "./routes/gaps.js";
import chatRouter from "./routes/chat.js";
import jiraRouter from "./routes/jira.js";
import kbRouter from "./routes/kb.js";
import domainsRouter from "./routes/domains.js";
import insightsRouter from "./routes/insights.js";
import upskillRouter from "./routes/upskill.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet({ contentSecurityPolicy: false }));

// CORS — restrict origins in production to prevent cross-origin abuse.
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;
app.use(
  cors(
    allowedOrigins
      ? {
          origin(origin, cb) {
            // Allow server-to-server (no origin) and whitelisted origins
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error("Not allowed by CORS"));
          },
          credentials: true,
        }
      : undefined // wide-open for local dev when env var is unset
  )
);

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // SAML assertions come as form POSTs
app.use(cookieParser());

// Global rate limiter — safety net across all API routes
app.use("/api", apiLimiter);

app.use("/api/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/team", teamRouter);
app.use("/api/members", membersRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/proficiencies", proficienciesRouter);
app.use("/api/certifications", certificationsRouter);
app.use("/api/matrix", matrixRouter);
app.use("/api/gaps", gapsRouter);
app.use("/api/chat", aiLimiter, chatRouter);
app.use("/api/jira", jiraRouter);
app.use("/api/kb", kbRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/insights", aiLimiter, insightsRouter);
app.use("/api/upskill", upskillRouter);

// Centralized error handler — returns structured JSON, never leaks stack traces
app.use((err, req, res, _next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error(`[${req.method} ${req.path}]`, err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

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
