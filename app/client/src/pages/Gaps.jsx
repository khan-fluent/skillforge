import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";

export default function Gaps() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.gaps()
      .then(setData)
      .catch((e) => { console.error("Gaps fetch failed:", e); setError(e.message); });
  }, []);

  if (error) return (
    <div>
      <div className="page-hd"><div><h1>Knowledge gaps</h1></div></div>
      <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--bad)" }}>
        Failed to load: {error}. Try refreshing or signing out and back in.
      </div>
    </div>
  );

  if (!data) return <div style={{ padding: 48 }}><span className="loader"><span /><span /><span /></span></div>;

  const skills = data.skills || [];
  const summary = data.summary || { critical: 0, high_risk: 0, healthy: 0, total: 0 };

  const filtered = filter === "critical" ? skills.filter((s) => s.bus_factor === 0)
    : filter === "high" ? skills.filter((s) => s.bus_factor === 1)
    : filter === "healthy" ? skills.filter((s) => s.bus_factor >= 2)
    : skills;

  const domainRisk = {};
  for (const s of skills) {
    if (!domainRisk[s.domain]) domainRisk[s.domain] = { critical: 0, high: 0, healthy: 0, total: 0 };
    domainRisk[s.domain].total += 1;
    if (s.bus_factor === 0) domainRisk[s.domain].critical += 1;
    else if (s.bus_factor === 1) domainRisk[s.domain].high += 1;
    else domainRisk[s.domain].healthy += 1;
  }

  const riskColor = (bf) => bf === 0 ? "var(--bad)" : bf === 1 ? "var(--warn)" : "var(--good)";
  const healthPct = summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge gaps</h1>
          <p>Bus-factor analysis for every skill your team tracks. Lower is riskier — find and fix single points of failure.</p>
        </div>
      </div>

      {/* Summary cards — click to filter */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div
          className="card"
          style={{ cursor: "pointer", outline: filter === "critical" ? "2px solid var(--bad)" : "none", outlineOffset: -2 }}
          onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
        >
          <h3>Critical</h3>
          <div className="stat-value" style={{ color: "var(--bad)" }}>{summary.critical}</div>
          <div className="stat-sub">no proficient owner — immediate risk</div>
          {summary.critical > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skills.filter((s) => s.bus_factor === 0).map((s) => (
                <span key={s.id} className="pill bad" style={{ fontSize: 10 }}>{s.name}</span>
              ))}
            </div>
          )}
        </div>
        <div
          className="card"
          style={{ cursor: "pointer", outline: filter === "high" ? "2px solid var(--warn)" : "none", outlineOffset: -2 }}
          onClick={() => setFilter(filter === "high" ? "all" : "high")}
        >
          <h3>High risk</h3>
          <div className="stat-value" style={{ color: "var(--warn)" }}>{summary.high_risk}</div>
          <div className="stat-sub">single point of failure</div>
        </div>
        <div
          className="card"
          style={{ cursor: "pointer", outline: filter === "healthy" ? "2px solid var(--good)" : "none", outlineOffset: -2 }}
          onClick={() => setFilter(filter === "healthy" ? "all" : "healthy")}
        >
          <h3>Healthy</h3>
          <div className="stat-value" style={{ color: "var(--good)" }}>{summary.healthy}</div>
          <div className="stat-sub">two or more experts</div>
        </div>
      </div>

      {/* Charts */}
      {skills.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: 32 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ alignSelf: "stretch" }}>Overall health</h3>
            <div style={{ margin: "20px 0 16px" }}>
              <DonutChart
                segments={[
                  { value: summary.critical, color: "#b8482e", label: "Critical" },
                  { value: summary.high_risk, color: "#b8862e", label: "High risk" },
                  { value: summary.healthy, color: "#5b8a5b", label: "Healthy" },
                ]}
                size={180}
                strokeWidth={24}
                centerLabel={`${healthPct}%`}
                centerSub="healthy"
              />
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--ink-soft)" }}>
              <Legend color="#b8482e" label={`Critical (${summary.critical})`} />
              <Legend color="#b8862e" label={`High (${summary.high_risk})`} />
              <Legend color="#5b8a5b" label={`Healthy (${summary.healthy})`} />
            </div>
          </div>

          <div className="card">
            <h3>Risk by domain</h3>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(domainRisk).sort((a, b) => (b[1].critical + b[1].high) - (a[1].critical + a[1].high)).map(([domain, info]) => (
                <div key={domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)", fontWeight: 500 }}>{domain}</span>
                    <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{info.critical + info.high} at risk / {info.total}</span>
                  </div>
                  <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--paper-warm)" }}>
                    {info.critical > 0 && <div style={{ width: `${(info.critical / info.total) * 100}%`, background: "#b8482e" }} />}
                    {info.high > 0 && <div style={{ width: `${(info.high / info.total) * 100}%`, background: "#b8862e" }} />}
                    {info.healthy > 0 && <div style={{ width: `${(info.healthy / info.total) * 100}%`, background: "#5b8a5b" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter indicator */}
      {filter !== "all" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Showing: <strong style={{ textTransform: "capitalize" }}>{filter}</strong> ({filtered.length})</span>
          <button className="btn ghost small" onClick={() => setFilter("all")} style={{ padding: "4px 12px", fontSize: 11 }}>Show all</button>
        </div>
      )}

      {/* Skill cards */}
      <div className="gap-grid">
        {filtered.map((s) => {
          const tier = s.bus_factor === 0 ? "critical" : s.bus_factor === 1 ? "high" : "";
          const isOpen = expandedId === s.id;
          return (
            <div
              key={s.id}
              className={`gap-card ${tier}`}
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedId(isOpen ? null : s.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div className="domain">{s.domain}</div>
                  <div className="name">{s.name}</div>
                </div>
                <span className={`pill ${s.bus_factor === 0 ? "bad" : s.bus_factor === 1 ? "warn" : "good"}`} style={{ fontSize: 10 }}>
                  {s.bus_factor === 0 ? "Critical" : s.bus_factor === 1 ? "At risk" : "Healthy"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "end", gap: 16, marginTop: 14 }}>
                <div className="bf" style={{ color: riskColor(s.bus_factor) }}>
                  {s.bus_factor}<span className="bf-label">bus factor</span>
                </div>
                <div style={{ flex: 1, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-mute)", marginBottom: 4 }}>
                    <span>{s.bus_factor} proficient</span>
                    <span>{s.total_known} know it</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${s.total_known > 0 ? (s.bus_factor / Math.max(s.total_known, 1)) * 100 : 0}%`,
                      background: riskColor(s.bus_factor),
                      borderRadius: 999,
                      minWidth: s.bus_factor > 0 ? 8 : 0,
                    }} />
                  </div>
                </div>
              </div>

              <div className="owners" style={{ fontSize: 13 }}>
                {s.proficient_people?.length
                  ? s.proficient_people.join(", ")
                  : "No proficient owners yet"}
              </div>

              {isOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {s.bus_factor === 0 && (
                    <div><strong style={{ color: "var(--bad)" }}>Action needed:</strong> Nobody on the team is proficient in {s.name}. Consider cross-training or hiring.</div>
                  )}
                  {s.bus_factor === 1 && (
                    <div><strong style={{ color: "var(--warn)" }}>Risk:</strong> Only <strong>{s.proficient_people?.[0]}</strong> is proficient. If they're unavailable, the team has a gap. Pair them for knowledge transfer.</div>
                  )}
                  {s.bus_factor >= 2 && (
                    <div><strong style={{ color: "var(--good)" }}>Healthy:</strong> {s.bus_factor} people are proficient in {s.name}. No immediate continuity risk.</div>
                  )}
                  {s.total_known > s.bus_factor && (
                    <div style={{ marginTop: 8 }}>
                      {s.total_known - s.bus_factor} other{s.total_known - s.bus_factor > 1 ? "s" : ""} know this skill at a lower level — potential upskilling candidates.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
            {filter !== "all" ? "No skills match this filter." : "Add some skills and set proficiencies — gap analysis will fill in here."}
          </div>
        )}
      </div>
    </>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 4, background: color }} />
      {label}
    </span>
  );
}
