import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import JiraWidget from "../components/JiraWidget.jsx";
import StatCard from "../components/StatCard.jsx";
import BarChart from "../components/BarChart.jsx";
import DonutChart from "../components/DonutChart.jsx";

const DOMAIN_COLORS = {
  cloud: "#6d8bb8", databases: "#c8956d", languages: "#8b6db8",
  tools: "#6db896", practices: "#b8a06d", security: "#b86d6d",
  data: "#6db8b8", other: "#9a9a9a",
};

export default function Dashboard() {
  const { user, team } = useAuth();
  const nav = useNavigate();
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [gaps, setGaps] = useState(null);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    Promise.all([api.members(), api.skills(), api.gaps(), api.certifications()])
      .then(([m, s, g, c]) => { setMembers(m); setSkills(s); setGaps(g); setCerts(c); })
      .catch(() => {});
  }, []);

  const expiring = certs.filter((c) => c.status === "expiring_soon" || c.status === "expired");
  const proficientCount = skills.reduce((sum, s) => sum + (s.proficient_count || 0), 0);
  const pendingInvites = members.filter((m) => !m.accepted_at);
  const criticalSkills = gaps?.skills.filter((s) => s.bus_factor === 0) || [];
  const highRiskSkills = gaps?.skills.filter((s) => s.bus_factor === 1) || [];
  const empty = members.length <= 1 && skills.length === 0;

  // Domain breakdown for donut chart
  const domainCounts = skills.reduce((acc, s) => {
    acc[s.domain] = (acc[s.domain] || 0) + 1;
    return acc;
  }, {});
  const donutSegments = Object.entries(domainCounts).map(([d, v]) => ({
    value: v, color: DOMAIN_COLORS[d] || "#9a9a9a", label: d,
  }));

  // Proficiency distribution for bar chart
  const profByLevel = [1, 2, 3, 4, 5].map((lvl) => {
    const count = skills.reduce((sum, s) => {
      // Approximate from avg_level and people_count
      return sum;
    }, 0);
    return { label: ["Novice", "Beginner", "Competent", "Proficient", "Expert"][lvl - 1], value: 0 };
  });

  // Top skilled people
  const topPeople = [...members].sort((a, b) => b.skill_count - a.skill_count).slice(0, 5);

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
        <StatCard
          label="People"
          value={members.length}
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
          label="Skills tracked"
          value={skills.length}
          sub={`${proficientCount} proficient assignments`}
          onClick={() => nav("/app/skills")}
          detail={skills.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>By domain</div>
              {Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: DOMAIN_COLORS[d] || "#9a9a9a" }} />
                    <span style={{ textTransform: "capitalize" }}>{d}</span>
                  </div>
                  <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{c}</span>
                </div>
              ))}
            </div>
          ) : null}
        />
        <StatCard
          label="Critical gaps"
          value={gaps?.summary.critical ?? "—"}
          color={gaps?.summary.critical > 0 ? "var(--bad)" : "var(--good)"}
          sub="skills with no expert"
          onClick={() => nav("/app/gaps")}
          detail={criticalSkills.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--bad)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>No proficient owner</div>
              {criticalSkills.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span className="pill bad" style={{ fontSize: 10 }}>bus factor 0</span>
                </div>
              ))}
            </div>
          ) : null}
        />
        <StatCard
          label="Cert renewals"
          value={expiring.length}
          color={expiring.length > 0 ? "var(--warn)" : "var(--good)"}
          sub="expired or due in 90 days"
          onClick={() => nav("/app/certifications")}
          detail={expiring.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--warn)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Needs attention</div>
              {expiring.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{c.person_name}</span>
                    <span style={{ color: "var(--ink-mute)", marginLeft: 6 }}>{c.name}</span>
                  </div>
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

      {/* Charts row */}
      {skills.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22, marginBottom: 32 }}>
          {/* Domain donut */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ alignSelf: "stretch" }}>Skill domains</h3>
            <div style={{ margin: "20px 0 16px" }}>
              <DonutChart
                segments={donutSegments}
                size={150}
                strokeWidth={20}
                centerLabel={skills.length}
                centerSub="skills"
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {donutSegments.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-soft)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: s.color }} />
                  <span style={{ textTransform: "capitalize" }}>{s.label}</span>
                  <span className="mono" style={{ color: "var(--ink-mute)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk distribution donut */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ alignSelf: "stretch" }}>Risk distribution</h3>
            {gaps && (
              <>
                <div style={{ margin: "20px 0 16px" }}>
                  <DonutChart
                    segments={[
                      { value: gaps.summary.critical, color: "var(--bad)", label: "Critical" },
                      { value: gaps.summary.high_risk, color: "var(--warn)", label: "High risk" },
                      { value: gaps.summary.healthy, color: "var(--good)", label: "Healthy" },
                    ]}
                    size={150}
                    strokeWidth={20}
                    centerLabel={gaps.summary.total}
                    centerSub="total"
                  />
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--bad)" }} /> Critical {gaps.summary.critical}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--warn)" }} /> High {gaps.summary.high_risk}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--good)" }} /> Healthy {gaps.summary.healthy}</span>
                </div>
              </>
            )}
          </div>

          {/* Top contributors */}
          <div className="card">
            <h3>Top skill holders</h3>
            <div style={{ marginTop: 18 }}>
              <BarChart
                data={topPeople.map((p) => ({
                  label: p.name,
                  value: p.skill_count,
                  color: "var(--accent)",
                }))}
                formatValue={(v) => `${v} skills`}
                height={18}
                gap={12}
              />
            </div>
          </div>
        </div>
      )}

      <div className="col-2">
        <div className="card">
          <h3>Top risk skills</h3>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {[...criticalSkills, ...highRiskSkills].slice(0, 6).map((s) => (
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
          <div style={{ marginTop: 18 }}>
            <BarChart
              data={Object.entries(
                skills.reduce((acc, s) => {
                  acc[s.domain] = acc[s.domain] || { proficient: 0, total: 0 };
                  acc[s.domain].total += 1;
                  acc[s.domain].proficient += s.proficient_count || 0;
                  return acc;
                }, {})
              ).map(([domain, info]) => ({
                label: domain,
                value: info.proficient,
                color: DOMAIN_COLORS[domain] || "#9a9a9a",
              }))}
              formatValue={(v) => `${v} proficient`}
              height={16}
              gap={14}
            />
            {!skills.length && <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>No skills tracked yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
