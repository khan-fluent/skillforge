import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function SSOCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setErr("No authentication token received. Please try again.");
      return;
    }

    auth.saveToken(token);
    refresh().then(() => nav("/app", { replace: true }));
  }, [params, nav, refresh]);

  if (err) {
    return (
      <div className="auth-shell">
        <main className="auth-main">
          <div className="auth-form">
            <h1>SSO Error</h1>
            <div className="error">{err}</div>
            <a href="/login" className="btn submit" style={{ textAlign: "center", display: "block", marginTop: "1rem" }}>
              Back to login
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="center-fill">
      <span className="loader"><span /><span /><span /></span>
    </div>
  );
}
