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
          <p>Manage your team, your profile, and integrations.</p>
        </div>
      </div>

      <div className="col-2" style={{ marginBottom: 22 }}>
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
        </div>
      </div>

      <JiraSettings isAdmin={user.role === "admin"} />
    </>
  );
}

function JiraSettings({ isAdmin }) {
  const [conn, setConn] = useState(null);
  const [filters, setFilters] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ base_url: "", email: "", api_token: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [synced, setSynced] = useState(null);

  const reload = async () => {
    const [c, f] = await Promise.all([api.jiraConnection(), api.jiraFilters().catch(() => [])]);
    setConn(c);
    setFilters(f);
  };
  useEffect(() => { reload(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api.setJiraConnection(form); setEditing(false); await reload(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Jira? Mock data will resume on the dashboard.")) return;
    await api.deleteJiraConnection();
    await reload();
  };

  const sync = async () => {
    setBusy(true);
    try { const r = await api.jiraSync(); setSynced(r.synced); await reload(); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
        <div>
          <h3>Integrations</h3>
          <h2 className="serif" style={{ fontSize: 28, margin: "8px 0 4px" }}>Jira Cloud</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "0 0 4px" }}>
            Pull tickets, story points, and sprint data into Skillforge. Powers the
            throughput widget on the dashboard and gives the AI assistant context
            on what your team is shipping.
          </p>
        </div>
        {conn?.connected && <span className="pill good">Connected</span>}
        {conn && !conn.connected && <span className="pill warn">Mock data</span>}
      </div>

      {!conn?.connected && !editing && isAdmin && (
        <div style={{ background: "var(--paper-warm)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, marginTop: 20 }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 14 }}>
            <strong>How to connect:</strong>
            <ol style={{ margin: "10px 0 0 18px", padding: 0 }}>
              <li>Go to <span className="mono">id.atlassian.com → Security → API tokens</span> and create a token.</li>
              <li>Copy your Jira site URL (e.g. <span className="mono">https://acme.atlassian.net</span>).</li>
              <li>Paste both below along with the email tied to your Atlassian account.</li>
            </ol>
          </div>
          <button className="btn small" onClick={() => setEditing(true)}>Connect Jira</button>
        </div>
      )}

      {editing && (
        <form onSubmit={save} style={{ marginTop: 20, padding: 22, background: "var(--paper-warm)", border: "1px solid var(--line)", borderRadius: 14 }}>
          {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">Jira site URL</label>
            <input className="input" placeholder="https://acme.atlassian.net" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} required />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">Atlassian account email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">API token</label>
            <input className="input" type="password" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} required />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn small" disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
            <button type="button" className="btn ghost small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      {conn?.connected && (
        <div style={{ marginTop: 20, padding: 22, background: "var(--paper-warm)", border: "1px solid var(--line)", borderRadius: 14 }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            <div><span style={{ color: "var(--ink-mute)" }}>Site:</span> <span className="mono">{conn.base_url}</span></div>
            <div><span style={{ color: "var(--ink-mute)" }}>Account:</span> <span className="mono">{conn.email}</span></div>
            <div><span style={{ color: "var(--ink-mute)" }}>Last sync:</span> {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "never"}</div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn small" onClick={sync} disabled={busy}>{busy ? "Syncing…" : "Sync now"}</button>
              <button className="btn ghost small" onClick={disconnect}>Disconnect</button>
              {synced != null && <span style={{ alignSelf: "center", fontSize: 12, color: "var(--good)" }}>Synced {synced} issues.</span>}
            </div>
          )}
        </div>
      )}

      {/* Filters live here too — only meaningful once connected, but admin can pre-stage them. */}
      {isAdmin && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ marginBottom: 10 }}>Saved filters</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: "0 0 14px" }}>
            JQL queries that get pulled on every weekly sync. Add as many as you like —
            "Sprint backlog", "Bugs in last 14 days", "Closed by Aisha", anything valid in Jira.
          </p>
          <FilterList filters={filters} onChange={reload} />
        </div>
      )}
    </div>
  );
}

function FilterList({ filters, onChange }) {
  const [name, setName] = useState("");
  const [jql, setJql]   = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!name || !jql) return;
    setBusy(true);
    try { await api.createJiraFilter({ name, jql }); setName(""); setJql(""); onChange(); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this filter?")) return;
    await api.deleteJiraFilter(id);
    onChange();
  };

  return (
    <>
      {filters.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {filters.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--paper-warm)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{f.jql}</div>
              </div>
              <button onClick={() => remove(f.id)} style={{ color: "var(--ink-mute)", fontSize: 18, padding: "0 6px" }}>×</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8 }}>
        <input className="input" placeholder="Filter name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input mono" placeholder='project = SKL AND sprint in openSprints()' value={jql} onChange={(e) => setJql(e.target.value)} style={{ fontSize: 12 }} />
        <button className="btn small" disabled={busy || !name || !jql}>Add</button>
      </form>
    </>
  );
}
