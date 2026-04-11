import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import JiraWidget from "../components/JiraWidget.jsx";
import StatCard from "../components/StatCard.jsx";
import DonutChart from "../components/DonutChart.jsx";

const PALETTE = [
  { stroke: "#6c7bff", fill: "rgba(108,123,255,0.15)" },
  { stroke: "#e0734a", fill: "rgba(224,115,74,0.12)" },
  { stroke: "#5bbd5b", fill: "rgba(91,189,91,0.12)" },
  { stroke: "#d4a032", fill: "rgba(212,160,50,0.12)" },
  { stroke: "#a67bdb", fill: "rgba(166,123,219,0.12)" },
  { stroke: "#3bbfbf", fill: "rgba(59,191,191,0.12)" },
  { stroke: "#db6b9d", fill: "rgba(219,107,157,0.12)" },
  { stroke: "#8bbd3b", fill: "rgba(139,189,59,0.12)" },
];

export default function Dashboard() {
  const { user, team } = useAuth();
  const nav = useNavigate();
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [gaps, setGaps] = useState(null);
  const [certs, setCerts] = useState([]);
  const [matrixData, setMatrixData] = useState(null);

  useEffect(() => {
    Promise.all([api.members(), api.skills(), api.gaps(), api.certifications(), api.matrix()])
      .then(([m, s, g, c, mx]) => { setMembers(m); setSkills(s); setGaps(g); setCerts(c); setMatrixData(mx); })
      .catch(() => {});
  }, []);

  const expiring = certs.filter((c) => c.status === "expiring_soon" || c.status === "expired");
  const proficientCount = skills.reduce((sum, s) => sum + (s.proficient_count || 0), 0);
  const pendingInvites = members.filter((m) => !m.accepted_at);
  const criticalSkills = gaps?.skills.filter((s) => s.bus_factor === 0) || [];
  const highRiskSkills = gaps?.skills.filter((s) => s.bus_factor === 1) || [];
  const riskSkills = [...criticalSkills, ...highRiskSkills].slice(0, 8);
  const empty = members.length <= 1 && skills.length === 0;

  const domainCounts = skills.reduce((acc, s) => {
    acc[s.domain] = (acc[s.domain] || 0) + 1;
    return acc;
  }, {});

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
            Add your first teammates and the skills you want to track.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link to="/app/people" className="btn">Add people</Link>
            <Link to="/app/skills" className="btn ghost">Add skills</Link>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-row">
        <StatCard
          label="People" value={members.length}
          sub={`${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
          onClick={() => nav("/app/people")}
          detail={pendingInvites.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Pending invites</div>
              {pendingInvites.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{m.name}</span>
                  <span className="pill warn" style={{ fontSize: 10 }}>pending</span>
                </div>
              ))}
            </div>
          ) : null}
        />
        <StatCard
          label="Skills tracked" value={skills.length}
          sub={`${proficientCount} proficient assignments`}
          onClick={() => nav("/app/skills")}
          detail={skills.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>By domain</div>
              {Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ textTransform: "capitalize" }}>{d}</span>
                  <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{c}</span>
                </div>
              ))}
            </div>
          ) : null}
        />
        <StatCard
          label="Critical gaps" value={gaps?.summary.critical ?? "\u2014"}
          color={gaps?.summary.critical > 0 ? "var(--bad)" : "var(--good)"}
          sub="skills with no expert" onClick={() => nav("/app/gaps")}
          detail={criticalSkills.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--bad)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>No proficient owner</div>
              {criticalSkills.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span className="pill bad" style={{ fontSize: 10 }}>bus factor 0</span>
                </div>
              ))}
            </div>
          ) : null}
        />
        <StatCard
          label="Cert renewals" value={expiring.length}
          color={expiring.length > 0 ? "var(--warn)" : "var(--good)"}
          sub="expired or due in 90 days" onClick={() => nav("/app/certifications")}
          detail={expiring.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--warn)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Needs attention</div>
              {expiring.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{c.person_name}</span>
                  <span className={`pill ${c.status === "expired" ? "bad" : "warn"}`} style={{ fontSize: 10 }}>
                    {c.status === "expired" ? "expired" : c.expires_on}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        />
      </div>

      <JiraWidget />

      {/* Main content: risk skills + radar */}
      {skills.length > 0 && (
        <div className="dash-panels">
          {/* Top risk skills */}
          <div className="card dash-risk-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Top risk skills</h3>
              {gaps && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="pill bad" style={{ fontSize: 10 }}>{gaps.summary.critical} critical</span>
                  <span className="pill warn" style={{ fontSize: 10 }}>{gaps.summary.high_risk} at risk</span>
                </div>
              )}
            </div>
            {riskSkills.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {riskSkills.map((s) => (
                  <div key={s.id} className="dash-risk-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                        {s.proficient_people?.length ? s.proficient_people.join(", ") : "No proficient owners"}
                      </div>
                    </div>
                    <div className="dash-risk-indicator">
                      <div className="dash-risk-bar">
                        <div style={{
                          width: `${s.total_known > 0 ? (s.bus_factor / Math.max(s.total_known, 1)) * 100 : 0}%`,
                          background: s.bus_factor === 0 ? "var(--bad)" : "var(--warn)",
                          minWidth: s.bus_factor > 0 ? 4 : 0,
                        }} />
                      </div>
                      <span className={`pill ${s.bus_factor === 0 ? "bad" : "warn"}`} style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                        BF {s.bus_factor}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 32, color: "var(--good)", fontSize: 14 }}>
                All skills are healthy — no single points of failure.
              </div>
            )}
            <Link to="/app/gaps" style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--accent)" }}>
              View full gap analysis
            </Link>
          </div>

          {/* Radar chart */}
          <div className="card dash-radar-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Team skill profile</h3>
            </div>
            {matrixData ? (
              <MiniRadar matrixData={matrixData} />
            ) : (
              <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mute)" }}>Loading...</div>
            )}
            <Link to="/app/matrix" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
              Explore full matrix
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Mini Radar for Dashboard ───────────────────────────────────────────────

function MiniRadar({ matrixData }) {
  const people = matrixData.people || [];
  const skills = matrixData.skills || [];
  const cells = matrixData.cells || {};

  const SIZE = 360;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R = SIZE * 0.32;
  const maxLevel = 5;
  const n = skills.length;

  if (n < 3) return <div style={{ textAlign: "center", padding: 24, color: "var(--ink-mute)", fontSize: 13 }}>Need at least 3 skills for radar.</div>;

  const angleStep = (2 * Math.PI) / n;
  const polar = (i, level) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (level / maxLevel) * R;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="matrix-svg" style={{ maxWidth: 340 }}>
        {/* Grid */}
        {[1, 2, 3, 4, 5].map((lv) => {
          const pts = Array.from({ length: n }, (_, i) => polar(i, lv));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
          return <path key={lv} d={d} fill="none" className="grid-line" />;
        })}

        {/* Spokes + labels */}
        {skills.map((s, i) => {
          const end = polar(i, maxLevel);
          const label = polar(i, maxLevel + 0.9);
          return (
            <g key={s.id}>
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="grid-line" />
              <text x={label.x} y={label.y} className="axis-label"
                textAnchor={label.x < cx - 10 ? "end" : label.x > cx + 10 ? "start" : "middle"}
                dominantBaseline={label.y < cy - 10 ? "auto" : label.y > cy + 10 ? "hanging" : "middle"}
                style={{ fontSize: 9 }}
              >{s.name.length > 14 ? s.name.slice(0, 12) + "\u2026" : s.name}</text>
            </g>
          );
        })}

        {/* Person polygons */}
        {people.map((p, pi) => {
          const pal = PALETTE[pi % PALETTE.length];
          const pts = skills.map((s, i) => polar(i, cells[`${p.id}:${s.id}`] || 0));
          const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ") + " Z";
          return (
            <g key={pi}>
              <path d={d} fill={pal.fill} stroke={pal.stroke} strokeWidth={1.5} strokeLinejoin="round" />
              {pts.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={pal.stroke} stroke="var(--paper-card)" strokeWidth={1}>
                  <title>{p.name}: {skills[i].name} — {cells[`${p.id}:${skills[i].id}`] || 0}/5</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
        {people.map((p, i) => (
          <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-soft)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 50, background: PALETTE[i % PALETTE.length].stroke }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
