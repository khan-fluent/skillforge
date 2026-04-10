import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState(params.get("error") || "");
  const [busy, setBusy] = useState(false);
  const [authMethod, setAuthMethod] = useState(null);

  useEffect(() => {
    api.authProviders().then((p) => setAuthMethod(p)).catch(() => {});
  }, []);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(form); nav("/app"); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const ssoEnabled = authMethod?.sso;

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand">Skillforge<span style={{ color: "#b8c0ff" }}>.</span></div>
        <div className="quote">
          Welcome back. Your team's <em>knowledge atlas</em> is right where you left it.
        </div>
        <div className="footnote">Know what your team knows.</div>
      </aside>
      <main className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <h1>Sign in</h1>
          <p className="lede">Pick up where you left off.</p>
          {err && <div className="error">{err}</div>}

          {ssoEnabled && (
            <>
              <a href="/api/auth/sso" className="btn submit sso-btn">
                Sign in with SSO
              </a>
              <div className="divider"><span>or sign in with email</span></div>
            </>
          )}

          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={change("email")} required />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={change("password")} required />
          </div>
          <button className="btn submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
          <div className="alt">No team yet? <Link to="/signup">Create one</Link></div>
        </form>
      </main>
    </div>
  );
}
