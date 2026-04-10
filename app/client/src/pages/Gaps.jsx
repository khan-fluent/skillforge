import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";

export default function Gaps() {
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [source, setSource] = useState("skills"); // skills | domains
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api.gaps(), api.domainGaps()])
      .then(([s, d]) => { setSkillsData(s); setDomainsData(d); })
      .catch((e) => { console.error("Gaps fetch failed:", e); setError(e.message); });
  }, []);

  // Clear selection when switching source
  useEffect(() => { setSelected(null); }, [source]);

  if (error) return (
    <div>
      <div className="page-hd"><div><h1>Knowledge gaps</h1></div></div>
      <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--bad)" }}>
        Failed to load: {error}. Try refreshing or signing out and back in.
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

      {/* Top bar: donut + source toggle + risk pills */}
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
          <button
            className={`gaps-pill critical ${riskFilter === "critical" ? "active" : ""}`}
            onClick={() => setRiskFilter(riskFilter === "critical" ? "all" : "critical")}
          >
            <span className="gaps-pill-count">{summary.critical}</span>
            <span className="gaps-pill-label">Critical</span>
          </button>
          <button
            className={`gaps-pill warn ${riskFilter === "high" ? "active" : ""}`}
            onClick={() => setRiskFilter(riskFilter === "high" ? "all" : "high")}
          >
            <span className="gaps-pill-count">{summary.high_risk}</span>
            <span className="gaps-pill-label">At risk</span>
          </button>
          <button
            className={`gaps-pill good ${riskFilter === "healthy" ? "active" : ""}`}
            onClick={() => setRiskFilter(riskFilter === "healthy" ? "all" : "healthy")}
          >
            <span className="gaps-pill-count">{summary.healthy}</span>
            <span className="gaps-pill-label">Healthy</span>
          </button>
        </div>

        <div className="gaps-view-toggle">
          <button className={`gaps-view-btn ${source === "skills" ? "active" : ""}`} onClick={() => setSource("skills")}>
            Skills
          </button>
          <button className={`gaps-view-btn ${source === "domains" ? "active" : ""}`} onClick={() => setSource("domains")}>
            Domains
          </button>
        </div>
      </div>

      {/* Filter indicator */}
      {riskFilter !== "all" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Showing: <strong>{riskFilter === "high" ? "At risk" : riskFilter === "critical" ? "Critical" : "Healthy"}</strong> ({filtered.length})
          </span>
          <button className="btn ghost small" onClick={() => setRiskFilter("all")} style={{ padding: "4px 12px", fontSize: 11 }}>
            Show all
          </button>
        </div>
      )}

      {/* Table + detail panel */}
      <div className="gaps-main">
        <div className={`gaps-viz ${selected ? "has-detail" : ""}`}>
          {items.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
              {source === "skills"
                ? "Add some skills and set proficiencies \u2014 gap analysis will fill in here."
                : "Add some domains and set proficiencies \u2014 gap analysis will fill in here."}
            </div>
          ) : (
            <GapsTable items={filtered} source={source} selected={selected} onSelect={setSelected} />
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

// ─── Table ───────────────────────────────────────────────────────────────────

function GapsTable({ items, source, selected, onSelect }) {
  const [sortCol, setSortCol] = useState("bus_factor");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortCol === "name") return mul * a.name.localeCompare(b.name);
      if (sortCol === "group") return mul * (a.domain || a.category || "").localeCompare(b.domain || b.category || "");
      return mul * ((a[sortCol] ?? 0) - (b[sortCol] ?? 0));
    });
  }, [items, sortCol, sortDir]);

  const SortHead = ({ col, children }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children} {sortCol === col && <span>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  const groupLabel = source === "skills" ? "Domain" : "Category";

  return (
    <div className="gaps-table-wrap">
      <table className="gaps-table">
        <thead>
          <tr>
            <SortHead col="name">Name</SortHead>
            <SortHead col="group">{groupLabel}</SortHead>
            <SortHead col="bus_factor">Bus factor</SortHead>
            <SortHead col="total_known">People</SortHead>
            <th>Owners</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.id}
              className={selected?.id === s.id ? "selected" : ""}
              onClick={() => onSelect(selected?.id === s.id ? null : s)}
              style={{ cursor: "pointer" }}
            >
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td><span className="domain-tag">{s.domain || s.category}</span></td>
              <td>
                <span className="bf-inline" style={{ color: riskColor(s.bus_factor) }}>{s.bus_factor}</span>
              </td>
              <td>{s.total_known}</td>
              <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                {s.proficient_people?.length ? s.proficient_people.join(", ") : "\u2014"}
              </td>
              <td>
                <span className={`pill ${s.bus_factor === 0 ? "bad" : s.bus_factor === 1 ? "warn" : "good"}`} style={{ fontSize: 10 }}>
                  {s.bus_factor === 0 ? "Critical" : s.bus_factor === 1 ? "At risk" : "Healthy"}
                </span>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--ink-mute)" }}>No items match this filter.</td></tr>
          )}
        </tbody>
      </table>
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
            background: color,
            minWidth: s.bus_factor > 0 ? 4 : 0,
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
            <strong>Risk:</strong> Only <strong>{s.proficient_people?.[0]}</strong> is proficient. If they're unavailable, the team has a gap. Pair them for knowledge transfer.
          </div>
        )}
        {s.bus_factor >= 2 && (
          <div className="detail-insight-text good">
            <strong>Healthy:</strong> {s.bus_factor} people are proficient in {s.name}. No immediate continuity risk.
          </div>
        )}
        {s.total_known > s.bus_factor && (
          <div className="detail-insight-sub">
            {s.total_known - s.bus_factor} other{s.total_known - s.bus_factor > 1 ? "s" : ""} know this at a lower level — potential upskilling candidates.
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
