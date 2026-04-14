import rateLimit from "express-rate-limit";

// Strict limiter for authentication endpoints (login, signup, accept invite).
// Prevents credential stuffing and brute-force attacks.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Moderate limiter for AI/LLM endpoints (chat, generate, insights).
// Prevents runaway LLM costs from automated abuse.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait a moment." },
});

// General API limiter — applied globally as a safety net.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
