import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

import { apiLimiter, authLimiter, aiLimiter } from "./middleware/rateLimiter.js";
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

export function createApp({ skipRateLimits = false } = {}) {
  const app = express();

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
              if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
              cb(new Error("Not allowed by CORS"));
            },
            credentials: true,
          }
        : undefined
    )
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!skipRateLimits) {
    app.use("/api", apiLimiter);
    app.use("/api/auth", authLimiter);
    app.use("/api/chat", aiLimiter);
    app.use("/api/insights", aiLimiter);
  }

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/team", teamRouter);
  app.use("/api/members", membersRouter);
  app.use("/api/skills", skillsRouter);
  app.use("/api/proficiencies", proficienciesRouter);
  app.use("/api/certifications", certificationsRouter);
  app.use("/api/matrix", matrixRouter);
  app.use("/api/gaps", gapsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/jira", jiraRouter);
  app.use("/api/kb", kbRouter);
  app.use("/api/domains", domainsRouter);
  app.use("/api/insights", insightsRouter);
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

  return app;
}
