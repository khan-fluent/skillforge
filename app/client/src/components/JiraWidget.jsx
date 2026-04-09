import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function JiraWidget() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { api.jiraSummary().then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const inFlightTotal = data.people.reduce((s, p) => s + p.in_progress, 0);

  return (
    <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 32px 22px", borderBottom: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Tickets · weekly throughput</h3>
            {data.mock ? <span className="pill warn">Mock data</span> : <span className="pill good">Live</span>}
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
        <Stat label="Tickets in flight" value={inFlightTotal} />
      </div>

      <div style={{ padding: "8px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <th style={{ padding: "14px 32px" }}>Person</th>
              <th>In flight</th>
              <th>Done · 7d</th>
              <th>Points · 7d</th>
              <th style={{ paddingRight: 32, width: "32%" }}>Top ticket this week</th>
            </tr>
          </thead>
          <tbody>
            {data.people.slice(0, 6).map((p, i) => {
              const max = Math.max(...data.people.map((x) => x.points_done_week), 1);
              const pct = (p.points_done_week / max) * 100;
              const isOpen = expanded === i;
              return (
                <Fragment key={i}>
                  <tr style={{ borderTop: "1px solid var(--line)", cursor: p.done_titles?.length ? "pointer" : "default" }}
                      onClick={() => p.done_titles?.length && setExpanded(isOpen ? null : i)}>
                    <td style={{ padding: "14px 32px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      {p.email && <div style={{ fontSize: 11, color: "var(--ink-mute)" }} className="mono">{p.email}</div>}
                    </td>
                    <td className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p.in_progress}</td>
                    <td className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p.issues_done_week}</td>
                    <td className="mono" style={{ fontSize: 13, color: "var(--ink)" }}><strong>{p.points_done_week}</strong></td>
                    <td style={{ paddingRight: 32 }}>
                      {p.top_ticket ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{p.top_ticket.key}</span>
                            <span className="pill" style={{ padding: "1px 8px", fontSize: 10 }}>{p.top_ticket.points} pts</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.top_ticket.summary}
                          </div>
                          <div style={{ height: 4, marginTop: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "var(--ink)", borderRadius: 999 }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>No tickets closed this week</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && p.top_ticket && (
                    <tr style={{ background: "var(--paper-warm)" }}>
                      <td colSpan={5} style={{ padding: "20px 32px", borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                          Highest-impact ticket · {p.top_ticket.project || "—"}
                        </div>
                        <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 8 }}>{p.top_ticket.summary}</div>
                        {p.top_ticket.description && (
                          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 14, whiteSpace: "pre-wrap" }}>
                            {p.top_ticket.description}
                          </div>
                        )}
                        {p.done_titles.length > 1 && (
                          <>
                            <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                              Everything else closed this week ({p.done_titles.length})
                            </div>
                            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                              {p.done_titles.map((t) => (
                                <li key={t.key} style={{ fontSize: 13, display: "flex", gap: 10 }}>
                                  <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11, minWidth: 70 }}>{t.key}</span>
                                  <span style={{ color: "var(--ink-soft)", flex: 1 }}>{t.summary}</span>
                                  <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{t.points} pts</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
