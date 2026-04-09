import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user, team } = useAuth();
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [gaps, setGaps] = useState(null);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    Promise.all([api.members(), api.skills(), api.gaps(), api.certifications()])
      .then(([m, s, g, c]) => { setMembers(m); setSkills(s); setGaps(g); setCerts(c); })
      .catch(() => {});
  }, []);

  const expiring = certs.filter((c) => c.status === "expiring_soon" || c.status === "expired").length;
  const proficientCount = skills.reduce((sum, s) => sum + (s.proficient_count || 0), 0);
  const empty = members.length <= 1 && skills.length === 0;

  return (
    <>
      <div className="page-hd">
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
            {team?.name}
          </div>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p>Here's the shape of your team's knowledge today.</p>
        </div>
        <Link to="/app/chat" className="btn accent">Ask Skillforge AI</Link>
      </div>

      {empty && (
        <div className="card" style={{ marginBottom: 32, background: "var(--paper-warm)", textAlign: "center", padding: 48 }}>
          <h3 style={{ textTransform: "none", fontSize: 14 }}>Your team is empty</h3>
          <h2 className="serif" style={{ fontSize: 36, margin: "8px 0 14px" }}>Let's get you set up.</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24, maxWidth: 460, margin: "0 auto 24px" }}>
            Add your first teammates and the skills you want to track. The matrix and gap analysis fill in as you go.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link to="/app/people" className="btn">Add people</Link>
            <Link to="/app/skills" className="btn ghost">Add skills</Link>
          </div>
        </div>
      )}

      <div className="stat-row">
        <div className="card">
          <h3>People</h3>
          <div className="stat-value">{members.length}</div>
          <div className="stat-sub">{members.filter((m) => !m.accepted_at).length} pending invites</div>
        </div>
        <div className="card">
          <h3>Skills tracked</h3>
          <div className="stat-value">{skills.length}</div>
          <div className="stat-sub">{proficientCount} proficient assignments</div>
        </div>
        <div className="card">
          <h3>Critical gaps</h3>
          <div className="stat-value" style={{ color: gaps?.summary.critical > 0 ? "var(--bad)" : "var(--good)" }}>
            {gaps?.summary.critical ?? "—"}
          </div>
          <div className="stat-sub">skills with no expert</div>
        </div>
        <div className="card">
          <h3>Cert renewals</h3>
          <div className="stat-value" style={{ color: expiring > 0 ? "var(--warn)" : "var(--good)" }}>{expiring}</div>
          <div className="stat-sub">expired or due in 90 days</div>
        </div>
      </div>

      <div className="col-2">
        <div className="card">
          <h3>Top risk skills</h3>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {gaps?.skills.filter((s) => s.bus_factor <= 1).slice(0, 6).map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.domain}</div>
                </div>
                <span className={`pill ${s.bus_factor === 0 ? "bad" : "warn"}`}>
                  bus factor {s.bus_factor}
                </span>
              </div>
            ))}
            {!gaps?.skills.length && <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>No skills tracked yet.</div>}
          </div>
        </div>
        <div className="card">
          <h3>Domain coverage</h3>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(
              skills.reduce((acc, s) => {
                acc[s.domain] = acc[s.domain] || { count: 0, total: 0 };
                acc[s.domain].count += 1;
                acc[s.domain].total += s.proficient_count || 0;
                return acc;
              }, {})
            ).map(([domain, info]) => {
              const pct = Math.min(100, (info.total / Math.max(info.count * Math.max(members.length, 1), 1)) * 100 * 2);
              return (
                <div key={domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)" }}>{domain}</span>
                    <span className="mono" style={{ color: "var(--ink-mute)" }}>{info.total} proficient · {info.count} skills</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--ink)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
            {!skills.length && <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>No skills tracked yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
