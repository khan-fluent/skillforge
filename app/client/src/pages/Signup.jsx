import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ team_name: "", name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await signup(form); nav("/app"); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand">Skillforge<span style={{ color: "#b8c0ff" }}>.</span></div>
        <div className="quote">
          "We finally <em>knew who knew what</em> — and it changed how we staff every project."
        </div>
        <div className="footnote">A warmer way to map your team's expertise.</div>
      </aside>
      <main className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <h1>Create your team</h1>
          <p className="lede">You'll be the first admin. Invite the rest of your team in a minute.</p>
          {err && <div className="error">{err}</div>}
          <div className="field">
            <label className="label">Team name</label>
            <input className="input" placeholder="Acme Platform Engineering" value={form.team_name} onChange={change("team_name")} required />
          </div>
          <div className="field">
            <label className="label">Your name</label>
            <input className="input" placeholder="Faisal Khan" value={form.name} onChange={change("name")} required />
          </div>
          <div className="field">
            <label className="label">Work email</label>
            <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={change("email")} required />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="At least 8 characters" value={form.password} onChange={change("password")} required minLength={8} />
          </div>
          <button className="btn submit" disabled={busy}>{busy ? "Creating…" : "Create team & sign in"}</button>
          <div className="alt">Already have an account? <Link to="/login">Sign in</Link></div>
        </form>
      </main>
    </div>
  );
}
