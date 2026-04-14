import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "skillforge",
  user: process.env.DB_USERNAME || "skillforge",
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export const query = (text, params) => pool.query(text, params);
export default pool;
