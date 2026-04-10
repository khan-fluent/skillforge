import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";
import BarChart from "../components/BarChart.jsx";

const RISK_COLORS = { 0: "var(--bad)", 1: "var(--warn)", 2: "var(--good)" };
const RISK_BG     = { 0: "linear-gradient(180deg, var(--paper-card) 0%, #f5dcd244 100%)", 1: "var(--paper-card)", 2: "var(--paper-card)" };

export default function Gaps() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all"); // all | critical | high | healthy
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { api.gaps().then(setData).catch(() => {}); }, []);
  if (!data) return <span className="loader"><span /><span /><span /></span>;

  const filtered = useMemo(() => {
    if (filter === "critical") return data.skills.filter((s) => s.bus_factor === 0);
    if (filter === "high")     return data.skills.filter((s) => s.bus_factor === 1);
    if (filter === "healthy")  return data.skills.filter((s) => s.bus_factor >= 2);
    return data.skills;
  }, [data, filter]);

  // Domain risk breakdown
  const domainRisk = useMemo(() => {
    const d = {};
    for (const s of data.skills) {
      if (!d[s.domain]) d[s.domain] = { critical: 0, high: 0, healthy: 0, total: 0 };
      d[s.domain].total += 1;
      if (s.bus_factor === 0) d[s.domain].critical += 1;
      else if (s.bus_factor === 1) d[s.domain].high += 1;
      else d[s.domain].healthy += 1;
    }
    return d;
  }, [data]);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge gaps</h1>
          <p>Bus-factor analysis for every skill your team tracks. Lower is riskier — find and fix single points of failure.</p>
        </div>
      </div>

      {/* Summary row — clickable to filter */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div
          className="card"
          style={{ cursor: "pointer", outline: filter === "critical" ? "2px solid var(--bad)" : "none", outlineOffset: -2 }}
          onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
        >
          <h3>Critical</h3>
          <div className="stat-value" style={{ color: "var(--bad)" }}>{data.summary.critical}</div>
          <div className="stat-sub">no proficient owner — immediate risk</div>
          {data.summary.critical > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.skills.filter((s) => s.bus_factor === 0).map((s) => (
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
          <div className="stat-value" style={{ color: "var(--warn)" }}>{data.summary.high_risk}</div>
          <div className="stat-sub">single point of failure — one vacation away from zero</div>
        </div>
        <div
          className="card"
          style={{ cursor: "pointer", outline: filter === "healthy" ? "2px solid var(--good)" : "none", outlineOffset: -2 }}
          onClick={() => setFilter(filter === "healthy" ? "all" : "healthy")}
        >
          <h3>Healthy</h3>
          <div className="stat-value" style={{ color: "var(--good)" }}>{data.summary.healthy}</div>
          <div className="stat-sub">two or more experts — safe</div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: 32 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h3 style={{ alignSelf: "stretch" }}>Overall health</h3>
          <div style={{ margin: "20px 0 16px" }}>
            <DonutChart
              segments={[
                { value: data.summary.critical, color: "var(--bad)", label: "Critical" },
                { value: data.summary.high_risk, color: "var(--warn)", label: "High risk" },
                { value: data.summary.healthy, color: "var(--good)", label: "Healthy" },
              ]}
              size={180}
              strokeWidth={24}
              centerLabel={`${data.summary.total > 0 ? Math.round((data.summary.healthy / data.summary.total) * 100) : 0}%`}
              centerSub="healthy"
            />
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--ink-soft)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 4, background: "var(--bad)" }} /> Critical ({data.summary.critical})</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 4, background: "var(--warn)" }} /> High ({data.summary.high_risk})</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 4, background: "var(--good)" }} /> Healthy ({data.summary.healthy})</span>
          </div>
        </div>

        <div className="card">
          <h3>Risk by domain</h3>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(domainRisk).sort((a, b) => b[1].critical + b[1].high - (a[1].critical + a[1].high)).map(([domain, info]) => (
              <div key={domain}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)", fontWeight: 500 }}>{domain}</span>
                  <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{info.critical + info.high} at risk / {info.total}</span>
                </div>
                <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--paper-warm)" }}>
                  {info.critical > 0 && <div style={{ width: `${(info.critical / info.total) * 100}%`, background: "var(--bad)", transition: "width 0.4s ease" }} />}
                  {info.high > 0 && <div style={{ width: `${(info.high / info.total) * 100}%`, background: "var(--warn)", transition: "width 0.4s ease" }} />}
                  {info.healthy > 0 && <div style={{ width: `${(info.healthy / info.total) * 100}%`, background: "var(--good)", transition: "width 0.4s ease" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
              style={{ cursor: "pointer", background: isOpen ? RISK_BG[Math.min(s.bus_factor, 2)] : undefined }}
              onClick={() => setExpandedId(isOpen ? null : s.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div className="domain">{s.domain}</div>
                  <div className="name">{s.name}</div>
                </div>
                <span className={`pill ${s.bus_factor === 0 ? "bad" : s.bus_factor === 1 ? "warn" : "good"}`} style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                  {s.bus_factor === 0 ? "Critical" : s.bus_factor === 1 ? "At risk" : "Healthy"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "end", gap: 16, marginTop: 14 }}>
                <div>
                  <div className="bf" style={{ color: RISK_COLORS[Math.min(s.bus_factor, 2)] }}>
                    {s.bus_factor}<span className="bf-label">bus factor</span>
                  </div>
                </div>
                {/* Mini bar showing proficient vs total known */}
                <div style={{ flex: 1, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-mute)", marginBottom: 4 }}>
                    <span>{s.bus_factor} proficient</span>
                    <span>{s.total_known} know it</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${s.total_known > 0 ? (s.bus_factor / Math.max(s.total_known, 1)) * 100 : 0}%`,
                      background: RISK_COLORS[Math.min(s.bus_factor, 2)],
                      borderRadius: 999,
                      minWidth: s.bus_factor > 0 ? 8 : 0,
                    }} />
                  </div>
                </div>
              </div>

              <div className="owners" style={{ fontSize: 13 }}>
                {s.proficient_people && s.proficient_people.length
                  ? s.proficient_people.join(", ")
                  : "No proficient owners yet"}
              </div>

              {isOpen && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {s.bus_factor === 0 && (
                    <div><strong style={{ color: "var(--bad)" }}>Action needed:</strong> Nobody on the team is proficient in {s.name}. Consider cross-training or hiring.</div>
                  )}
                  {s.bus_factor === 1 && (
                    <div><strong style={{ color: "var(--warn)" }}>Risk:</strong> Only <strong>{s.proficient_people[0]}</strong> is proficient. If they're unavailable, the team has a gap. Pair them with someone for knowledge transfer.</div>
                  )}
                  {s.bus_factor >= 2 && (
                    <div><strong style={{ color: "var(--good)" }}>Healthy:</strong> {s.bus_factor} people are proficient in {s.name}. No immediate continuity risk.</div>
                  )}
                  {s.total_known > s.bus_factor && (
                    <div style={{ marginTop: 8 }}>
                      {s.total_known - s.bus_factor} other{s.total_known - s.bus_factor > 1 ? "s" : ""} know this skill at a lower level — potential candidates for upskilling.
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
