import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";

export default function Gaps() {
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [source, setSource] = useState("skills");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api.gaps(), api.domainGaps()])
      .then(([s, d]) => { setSkillsData(s); setDomainsData(d); })
      .catch((e) => { console.error("Gaps fetch failed:", e); setError(e.message); });
  }, []);

  useEffect(() => { setSelected(null); setRiskFilter("all"); }, [source]);

  if (error) return (
    <div>
      <div className="page-hd"><div><h1>Knowledge gaps</h1></div></div>
      <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--bad)" }}>
        Failed to load: {error}
      </div>
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
          <p>Bus-factor analysis — find and fix single points of failure.</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="gaps-topbar">
        <div className="gaps-donut-mini">
          <DonutChart
            segments={[
              { value: summary.critical, color: "#b8482e", label: "Critical" },
              { value: summary.high_risk, color: "#b8862e", label: "At risk" },
              { value: summary.healthy, color: "#5b8a5b", label: "Healthy" },
            ]}
            size={72}
            strokeWidth={10}
            centerLabel={`${healthPct}%`}
          />
        </div>

        <div className="gaps-pills">
          {[
            { key: "critical", label: "Critical", count: summary.critical, cls: "critical" },
            { key: "high", label: "At risk", count: summary.high_risk, cls: "warn" },
            { key: "healthy", label: "Healthy", count: summary.healthy, cls: "good" },
          ].map((p) => (
            <button key={p.key}
              className={`gaps-pill ${p.cls} ${riskFilter === p.key ? "active" : ""}`}
              onClick={() => setRiskFilter(riskFilter === p.key ? "all" : p.key)}
            >
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Showing: <strong>{riskFilter === "high" ? "At risk" : riskFilter === "critical" ? "Critical" : "Healthy"}</strong> ({filtered.length})
          </span>
          <button className="btn ghost small" onClick={() => setRiskFilter("all")} style={{ padding: "4px 12px", fontSize: 11 }}>Show all</button>
        </div>
      )}

      {/* Risk visualization + detail panel */}
      <div className="gaps-main">
        <div className={`gaps-viz ${selected ? "has-detail" : ""}`}>
          {items.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
              {source === "skills" ? "Add skills and set proficiencies to see gap analysis." : "Add domains and set proficiencies to see gap analysis."}
            </div>
          ) : (
            <RiskChart items={filtered} selected={selected} onSelect={setSelected} />
          )}
        </div>

        {selected && (
          <div className="gaps-detail">
            <DetailPanel item={selected} source={source} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Risk Bar Chart (SVG) ───────────────────────────────────────────────────

function RiskChart({ items, selected, onSelect }) {
  const ROW_H = 38;
  const W = 800;
  const PAD = { top: 10, left: 180, right: 60, bottom: 10 };
  const H = PAD.top + items.length * ROW_H + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;

  // Max people known for scaling
  const maxKnown = Math.max(...items.map((s) => s.total_known), 1);

  return (
    <div className="risk-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg risk-chart-svg">
        {/* Background grid */}
        {items.length > 0 && [0.25, 0.5, 0.75, 1].map((pct) => (
          <line key={pct} x1={PAD.left + plotW * pct} y1={PAD.top} x2={PAD.left + plotW * pct} y2={H - PAD.bottom}
            className="grid-line" strokeDasharray="2 4" />
        ))}

        {items.map((s, i) => {
          const cy = PAD.top + i * ROW_H + ROW_H / 2;
          const isSelected = selected?.id === s.id;
          const tier = s.bus_factor === 0 ? "critical" : s.bus_factor === 1 ? "warn" : "good";
          const color = s.bus_factor === 0 ? "var(--bad)" : s.bus_factor === 1 ? "var(--warn)" : "var(--good)";
          const fillColor = s.bus_factor === 0 ? "rgba(184,72,46,0.6)" : s.bus_factor === 1 ? "rgba(184,134,46,0.5)" : "rgba(91,138,91,0.45)";
          const bgColor = s.bus_factor === 0 ? "rgba(184,72,46,0.1)" : s.bus_factor === 1 ? "rgba(184,134,46,0.08)" : "rgba(91,138,91,0.06)";

          const totalW = (s.total_known / maxKnown) * plotW;
          const profW = s.total_known > 0 ? (s.bus_factor / s.total_known) * totalW : 0;

          return (
            <g key={s.id}
              onClick={() => onSelect(isSelected ? null : s)}
              style={{ cursor: "pointer" }}
            >
              {/* Row hover bg */}
              <rect x={0} y={cy - ROW_H / 2} width={W} height={ROW_H}
                fill={isSelected ? "var(--accent-soft)" : "transparent"}
                className="spread-row-bg" rx={4} />

              {/* Label */}
              <text x={PAD.left - 12} y={cy + 4} textAnchor="end"
                style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, fill: "var(--ink-soft)" }}>
                {s.name.length > 22 ? s.name.slice(0, 20) + "\u2026" : s.name}
              </text>

              {/* Total known bar (background) */}
              <rect x={PAD.left} y={cy - 10} width={Math.max(totalW, 4)} height={20}
                rx={4} fill={bgColor} />

              {/* Proficient bar (foreground) */}
              <rect x={PAD.left} y={cy - 10} width={Math.max(profW, s.bus_factor > 0 ? 4 : 0)} height={20}
                rx={4} fill={fillColor}
                style={{ transition: "width 0.3s ease" }} />

              {/* Bus factor number */}
              <text x={PAD.left + Math.max(totalW, 4) + 8} y={cy + 4}
                style={{ fontSize: 13, fontWeight: 700, fill: color, fontFamily: '"Instrument Serif", serif' }}>
                {s.bus_factor}
              </text>

              {/* Risk indicator dot */}
              <circle cx={W - PAD.right / 2} cy={cy} r={5}
                fill={color} opacity={s.bus_factor === 0 ? 1 : s.bus_factor === 1 ? 0.7 : 0.4} />
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="risk-chart-legend">
        <span><span className="risk-legend-bar" style={{ background: "rgba(91,138,91,0.45)" }} /> Proficient</span>
        <span><span className="risk-legend-bar" style={{ background: "rgba(91,138,91,0.08)" }} /> Known (any level)</span>
        <span style={{ marginLeft: "auto", color: "var(--ink-mute)", fontSize: 11 }}>Click any row for details</span>
      </div>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ item: s, source, onClose }) {
  const color = riskColor(s.bus_factor);
  const pct = s.total_known > 0 ? Math.round((s.bus_factor / s.total_known) * 100) : 0;
  const groupLabel = source === "skills" ? s.domain : s.category;

  return (
    <div className="card gaps-detail-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{groupLabel}</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>{s.name}</h2>
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
          <div className="detail-metric-label">Know it</div>
        </div>
        <div className="detail-metric">
          <div className="serif detail-metric-value">{pct}%</div>
          <div className="detail-metric-label">Proficient</div>
        </div>
      </div>

      <div className="detail-bar-wrap">
        <div className="detail-bar">
          <div style={{
            width: `${s.total_known > 0 ? (s.bus_factor / s.total_known) * 100 : 0}%`,
            background: color, minWidth: s.bus_factor > 0 ? 4 : 0,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>
          <span>{s.bus_factor} proficient</span>
          <span>{s.total_known} total</span>
        </div>
      </div>

      <div className="detail-insight">
        {s.bus_factor === 0 && (
          <div className="detail-insight-text bad">
            <strong>Action needed:</strong> Nobody on the team is proficient in {s.name}. Consider cross-training or hiring.
          </div>
        )}
        {s.bus_factor === 1 && (
          <div className="detail-insight-text warn">
            <strong>Risk:</strong> Only <strong>{s.proficient_people?.[0]}</strong> is proficient. If they're unavailable, the team has a gap.
          </div>
        )}
        {s.bus_factor >= 2 && (
          <div className="detail-insight-text good">
            <strong>Healthy:</strong> {s.bus_factor} people are proficient in {s.name}. No immediate risk.
          </div>
        )}
        {s.total_known > s.bus_factor && (
          <div className="detail-insight-sub">
            {s.total_known - s.bus_factor} other{s.total_known - s.bus_factor > 1 ? "s" : ""} know this at a lower level — upskilling candidates.
          </div>
        )}
      </div>

      {s.proficient_people?.length > 0 && (
        <div className="detail-owners">
          <div className="detail-owners-label">Proficient owners</div>
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
