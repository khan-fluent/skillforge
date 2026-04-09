import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Settings() {
  const { user, team, refresh } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [savedTeam, setSavedTeam] = useState(false);
  const [busyTeam, setBusyTeam] = useState(false);

  useEffect(() => { if (team?.name) setTeamName(team.name); }, [team?.name]);

  const saveTeam = async (e) => {
    e.preventDefault();
    setBusyTeam(true); setSavedTeam(false);
    try { await api.updateTeam({ name: teamName }); await refresh(); setSavedTeam(true); }
    finally { setBusyTeam(false); }
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Settings</h1>
          <p>Manage your team and your own profile.</p>
        </div>
      </div>

      <div className="col-2">
        <div className="card">
          <h3>Team</h3>
          <h2 className="serif" style={{ fontSize: 28, margin: "8px 0 20px" }}>Workspace details</h2>
          {user.role === "admin" ? (
            <form onSubmit={saveTeam}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label">Team name</label>
                <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
              </div>
              <button className="btn small" disabled={busyTeam}>{busyTeam ? "Saving…" : "Save"}</button>
              {savedTeam && <span style={{ marginLeft: 12, fontSize: 12, color: "var(--good)" }}>Saved.</span>}
            </form>
          ) : (
            <div style={{ color: "var(--ink-soft)" }}>
              <div style={{ fontSize: 14 }}>{team?.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>Only admins can rename the team.</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>You</h3>
          <h2 className="serif" style={{ fontSize: 28, margin: "8px 0 20px" }}>Your profile</h2>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            <div><span style={{ color: "var(--ink-mute)" }}>Name:</span> {user.name}</div>
            <div><span style={{ color: "var(--ink-mute)" }}>Email:</span> {user.email}</div>
            <div><span style={{ color: "var(--ink-mute)" }}>Role:</span> <span className={`pill ${user.role === "admin" ? "accent" : ""}`}>{user.role}</span></div>
            {user.job_title && <div><span style={{ color: "var(--ink-mute)" }}>Title:</span> {user.job_title}</div>}
          </div>
          <p style={{ color: "var(--ink-mute)", fontSize: 12, marginTop: 18 }}>
            Profile editing UI lands in v1.1. For now, ask an admin to update your name or title.
          </p>
        </div>
      </div>
    </>
  );
}
