import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function Dashboard() {
  const [people, setPeople] = useState([]);
  const [skills, setSkills] = useState([]);
  const [gaps, setGaps] = useState(null);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    Promise.all([api.people(), api.skills(), api.gaps(), api.certifications()])
      .then(([p, s, g, c]) => { setPeople(p); setSkills(s); setGaps(g); setCerts(c); })
      .catch(console.error);
  }, []);

  const expiringSoon = certs.filter((c) => c.status === "expiring_soon" || c.status === "expired").length;
  const expertCount = skills.reduce((sum, s) => sum + (s.proficient_count || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Knowledge Atlas</h1>
          <p>Your team's skill landscape, certifications, and bus-factor risks at a glance.</p>
        </div>
        <Link to="/chat" className="btn">✧ Ask Skillforge AI</Link>
      </div>

      <div className="stat-grid">
        <div className="card">
          <h3>Team Members</h3>
          <div className="value">{people.length}</div>
          <div className="sub">across all teams</div>
        </div>
        <div className="card">
          <h3>Skills Tracked</h3>
          <div className="value">{skills.length}</div>
          <div className="sub">{expertCount} proficient assignments</div>
        </div>
        <div className="card">
          <h3>Critical Gaps</h3>
          <div className="value" style={{ color: gaps?.summary.critical > 0 ? "var(--rose)" : "var(--emerald)" }}>
            {gaps?.summary.critical ?? "—"}
          </div>
          <div className="sub">skills with zero experts</div>
        </div>
        <div className="card">
          <h3>Cert Renewals</h3>
          <div className="value" style={{ color: expiringSoon > 0 ? "var(--amber)" : "var(--emerald)" }}>
            {expiringSoon}
          </div>
          <div className="sub">expired or expiring in 90d</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <h3>Top Risk Skills</h3>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {gaps?.skills.filter((s) => s.bus_factor <= 1).slice(0, 6).map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: "var(--text-faint)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.domain}</div>
                </div>
                <span className={`pill ${s.bus_factor === 0 ? "rose" : "amber"}`}>
                  bus factor {s.bus_factor}
                </span>
              </div>
            ))}
            {!gaps && <div className="loading"><span className="dot" /><span className="dot" /><span className="dot" /></div>}
          </div>
        </div>

        <div className="card">
          <h3>Domain Coverage</h3>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(
              skills.reduce((acc, s) => {
                acc[s.domain] = acc[s.domain] || { count: 0, total: 0 };
                acc[s.domain].count += 1;
                acc[s.domain].total += s.proficient_count || 0;
                return acc;
              }, {})
            ).map(([domain, info]) => {
              const pct = Math.min(100, (info.total / (info.count * Math.max(people.length, 1))) * 100 * 2);
              return (
                <div key={domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>{domain}</span>
                    <span className="mono" style={{ color: "var(--text-faint)" }}>{info.total} / {info.count} skills</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--grad-primary)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
