import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Accept() {
  const { token } = useParams();
  const nav = useNavigate();
  const { accept } = useAuth();
  const [invite, setInvite] = useState(null);
  const [err, setErr] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.invite(token).then(setInvite).catch((e) => setErr(e.message));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await accept({ token, password }); nav("/app"); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err && !invite) {
    return (
      <div className="auth-shell">
        <main className="auth-main">
          <div className="auth-form">
            <h1>Invite not found</h1>
            <p className="lede">{err}</p>
          </div>
        </main>
      </div>
    );
  }
  if (!invite) return <div className="center-fill"><span className="loader"><span /><span /><span /></span></div>;

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand">Skillforge<span style={{ color: "#b8c0ff" }}>.</span></div>
        <div className="quote">
          You've been invited to <em>{invite.team_name}</em>.
        </div>
        <div className="footnote">Set a password to join.</div>
      </aside>
      <main className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <h1>Hi, {invite.name.split(" ")[0]}</h1>
          <p className="lede">Set a password to join <strong>{invite.team_name}</strong> as a {invite.role}.</p>
          {err && <div className="error">{err}</div>}
          <div className="field">
            <label className="label">Email</label>
            <input className="input" value={invite.email} disabled />
          </div>
          <div className="field">
            <label className="label">Choose a password</label>
            <input className="input" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button className="btn submit" disabled={busy}>{busy ? "Joining…" : "Join team"}</button>
        </form>
      </main>
    </div>
  );
}
