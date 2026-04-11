import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";

export default function Gaps() {
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [source, setSource] = useState("skills");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api.gaps(), api.domainGaps(), api.insights()])
      .then(([s, d, ins]) => { setSkillsData(s); setDomainsData(d); setInsights(ins); })
      .catch((e) => { console.error("Gaps fetch failed:", e); setError(e.message); });
  }, []);

  useEffect(() => { setSelected(null); setRiskFilter("all"); }, [source]);

  if (error) return (
    <div>
      <div className="page-hd"><div><h1>Knowledge gaps</h1></div></div>
      <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--bad)" }}>Failed to load: {error}</div>
    </div>
  );

  if (!skillsData || !domainsData) return <div style={{ padding: 48 }}><span className="loader"><span /><span /><span /></span></div>;

  const data = source === "skills" ? skillsData : domainsData;
  const items = (source === "skills" ? data.skills : data.domains) || [];
  const summary = data.summary || { critical: 0, high_risk: 0, healthy: 0, total: 0 };

  const filtered = riskFilter === "critical" ? items.filter((s) => s.bus_factor === 0)
    : riskFilter === "high" ? items.filter((s) => s.bus_factor === 1)
    : riskFilter === "healthy" ? items.filter((s) => s.bus_factor >= 2)
    : items;

  const healthPct = summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge gaps</h1>
          <p>Bus-factor analysis — how many people are <strong>proficient (level 4+)</strong> in each skill.</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="gaps-topbar">
        <div className="gaps-donut-mini">
          <DonutChart
            segments={[
              { value: summary.critical, color: "#b8482e" },
              { value: summary.high_risk, color: "#b8862e" },
              { value: summary.healthy, color: "#5b8a5b" },
            ]}
            size={64} strokeWidth={9} centerLabel={`${healthPct}%`}
          />
        </div>
        <div className="gaps-pills">
          {[
            { key: "critical", label: "Critical", count: summary.critical, cls: "critical" },
            { key: "high", label: "At risk", count: summary.high_risk, cls: "warn" },
            { key: "healthy", label: "Healthy", count: summary.healthy, cls: "good" },
          ].map((p) => (
            <button key={p.key} className={`gaps-pill ${p.cls} ${riskFilter === p.key ? "active" : ""}`}
              onClick={() => setRiskFilter(riskFilter === p.key ? "all" : p.key)}>
              <span className="gaps-pill-count">{p.count}</span>
              <span className="gaps-pill-label">{p.label}</span>
            </button>
          ))}
        </div>
        <div className="gaps-view-toggle">
          <button className={`gaps-view-btn ${source === "skills" ? "active" : ""}`} onClick={() => setSource("skills")}>Skills</button>
          <button className={`gaps-view-btn ${source === "domains" ? "active" : ""}`} onClick={() => setSource("domains")}>Domains</button>
        </div>
      </div>

      {riskFilter !== "all" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Showing: <strong>{riskFilter === "high" ? "At risk" : riskFilter === "critical" ? "Critical" : "Healthy"}</strong> ({filtered.length})
          </span>
          <button className="btn ghost small" onClick={() => setRiskFilter("all")} style={{ padding: "3px 10px", fontSize: 10 }}>Show all</button>
        </div>
      )}

      {/* Compact risk list + detail */}
      <div className="gaps-main">
        <div className={`gaps-viz ${selected ? "has-detail" : ""}`}>
          {items.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
              Add {source} and set proficiencies to see gap analysis.
            </div>
          ) : (
            <div className="gaps-compact-list">
              {filtered.map((s) => {
                const isSelected = selected?.id === s.id;
                const color = riskColor(s.bus_factor);
                const pct = s.total_known > 0 ? Math.round((s.bus_factor / s.total_known) * 100) : 0;
                return (
                  <div key={s.id} className={`gaps-row ${isSelected ? "active" : ""}`} onClick={() => setSelected(isSelected ? null : s)}>
                    <div className="gaps-row-indicator" style={{ background: color }} />
                    <div className="gaps-row-info">
                      <span className="gaps-row-name">{s.name}</span>
                      <span className="gaps-row-meta">{s.domain || s.category}</span>
                    </div>
                    <div className="gaps-row-bar">
                      <div className="gaps-row-bar-bg">
                        <div style={{ width: `${pct}%`, background: color, minWidth: s.bus_factor > 0 ? 3 : 0 }} />
                      </div>
                    </div>
                    <div className="gaps-row-bf" style={{ color }}>
                      {s.bus_factor}
                    </div>
                    <span className="gaps-row-owners">
                      {s.proficient_people?.length ? s.proficient_people.join(", ") : "\u2014"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="gaps-detail">
            <DetailPanel item={selected} source={source} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="gaps-insights">
          <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>AI Insights</h3>
          <div className="gaps-insights-list">
            {insights.map((ins, i) => (
              <div key={i} className={`gaps-insight ${ins.priority}`}>
                <div className="gaps-insight-left">
                  <span className={`pill ${ins.priority === "critical" ? "bad" : ins.priority === "high" ? "warn" : ""}`} style={{ fontSize: 9 }}>
                    {ins.type === "upskill" ? "Upskill" : ins.type === "gap" ? "Gap" : ins.type === "domain" ? "Domain" : ins.type === "cert" ? "Cert" : ins.type === "team" ? "Team" : "Risk"}
                  </span>
                  <span className="gaps-insight-title">{ins.title}</span>
                </div>
                <span className="gaps-insight-desc">{ins.description}</span>
                <Link to={`/app/chat?context=${encodeURIComponent(ins.action)}`} className="gaps-insight-cta">
                  Take action
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DetailPanel({ item: s, source, onClose }) {
  const color = riskColor(s.bus_factor);
  const pct = s.total_known > 0 ? Math.round((s.bus_factor / s.total_known) * 100) : 0;

  return (
    <div className="card gaps-detail-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{source === "skills" ? s.domain : s.category}</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{s.name}</h2>
        </div>
        <button className="btn ghost small" onClick={onClose} style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}>&times;</button>
      </div>

      <div className="detail-metrics">
        <div className="detail-metric">
          <div className="serif detail-metric-value" style={{ color }}>{s.bus_factor}</div>
          <div className="detail-metric-label">Bus factor</div>
        </div>
        <div className="detail-metric">
          <div className="serif detail-metric-value">{s.total_known}</div>
          <div className="detail-metric-label">Total</div>
        </div>
        <div className="detail-metric">
          <div className="serif detail-metric-value">{pct}%</div>
          <div className="detail-metric-label">Level 4+</div>
        </div>
      </div>

      <div className="detail-insight">
        {s.bus_factor === 0 && (
          <div className="detail-insight-text bad">
            <strong>Action needed:</strong> Nobody is rated level 4+ in {s.name}.
            {s.total_known > 0 ? ` ${s.total_known} ${s.total_known === 1 ? "person knows" : "people know"} it at a lower level.` : ""}
          </div>
        )}
        {s.bus_factor === 1 && (
          <div className="detail-insight-text warn">
            <strong>Single point of failure:</strong> Only <strong>{s.proficient_people?.[0]}</strong> is at level 4+.
          </div>
        )}
        {s.bus_factor >= 2 && (
          <div className="detail-insight-text good">
            <strong>Healthy:</strong> {s.bus_factor} people are at level 4+.
          </div>
        )}
      </div>

      {s.proficient_people?.length > 0 && (
        <div className="detail-owners">
          <div className="detail-owners-label">Proficient</div>
          {s.proficient_people.map((name) => (
            <div key={name} className="detail-owner">{name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function riskColor(bf) {
  return bf === 0 ? "var(--bad)" : bf === 1 ? "var(--warn)" : "var(--good)";
}
