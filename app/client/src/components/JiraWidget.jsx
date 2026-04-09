import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function JiraWidget() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => { api.jiraSummary().then(setData).catch(() => {}); }, []);

  if (!data) return null;

  return (
    <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 32px 22px", borderBottom: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Tickets · weekly throughput</h3>
            {data.mock && <span className="pill warn">Mock data</span>}
            {!data.mock && <span className="pill good">Live</span>}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {data.mock
              ? "Showing simulated Jira data. Connect a real workspace to replace it with live tickets, sprints, and story points."
              : `Last sync ${data.last_sync_at ? new Date(data.last_sync_at).toLocaleString() : "never"}.`}
          </div>
        </div>
        {user.role === "admin" && (
          <Link to="/app/settings" className="btn ghost small">
            {data.mock ? "Connect Jira →" : "Manage connection"}
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)" }}>
        <Stat label="Issues this week" value={data.total_done_week} />
        <Stat label="Story points delivered" value={data.total_points_week} />
        <Stat label="Tickets in flight" value={data.people.reduce((s, p) => s + p.in_progress, 0)} />
      </div>

      <div style={{ padding: "8px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <th style={{ padding: "14px 32px" }}>Person</th>
              <th>In flight</th>
              <th>Done · 7d</th>
              <th>Points · 7d</th>
              <th style={{ paddingRight: 32, width: "32%" }}>Velocity</th>
            </tr>
          </thead>
          <tbody>
            {data.people.slice(0, 6).map((p, i) => {
              const max = Math.max(...data.people.map((x) => x.points_done_week), 1);
              const pct = (p.points_done_week / max) * 100;
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 32px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    {p.email && <div style={{ fontSize: 11, color: "var(--ink-mute)" }} className="mono">{p.email}</div>}
                  </td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p.in_progress}</td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p.issues_done_week}</td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--ink)" }}><strong>{p.points_done_week}</strong></td>
                  <td style={{ paddingRight: 32 }}>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--ink)", borderRadius: 999 }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.people.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: "var(--ink-mute)" }}>No tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: "20px 32px", borderRight: "1px solid var(--line)" }}>
      <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div className="serif" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}
