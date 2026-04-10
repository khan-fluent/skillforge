import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DonutChart from "../components/DonutChart.jsx";

const VIEWS = [
  { key: "bubble", label: "Bubble map" },
  { key: "domain", label: "By domain" },
  { key: "table", label: "Table" },
];

export default function Gaps() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("bubble");
  const [selected, setSelected] = useState(null);

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

  const healthPct = summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge gaps</h1>
          <p>Bus-factor analysis — find and fix single points of failure.</p>
        </div>
      </div>

      {/* Compact top bar: donut + stat pills + view toggle */}
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
            className={`gaps-pill critical ${filter === "critical" ? "active" : ""}`}
            onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
          >
            <span className="gaps-pill-count">{summary.critical}</span>
            <span className="gaps-pill-label">Critical</span>
          </button>
          <button
            className={`gaps-pill warn ${filter === "high" ? "active" : ""}`}
            onClick={() => setFilter(filter === "high" ? "all" : "high")}
          >
            <span className="gaps-pill-count">{summary.high_risk}</span>
            <span className="gaps-pill-label">At risk</span>
          </button>
          <button
            className={`gaps-pill good ${filter === "healthy" ? "active" : ""}`}
            onClick={() => setFilter(filter === "healthy" ? "all" : "healthy")}
          >
            <span className="gaps-pill-count">{summary.healthy}</span>
            <span className="gaps-pill-label">Healthy</span>
          </button>
        </div>

        <div className="gaps-view-toggle">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={`gaps-view-btn ${view === v.key ? "active" : ""}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter indicator */}
      {filter !== "all" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Showing: <strong style={{ textTransform: "capitalize" }}>{filter === "high" ? "At risk" : filter}</strong> ({filtered.length})
          </span>
          <button className="btn ghost small" onClick={() => setFilter("all")} style={{ padding: "4px 12px", fontSize: 11 }}>
            Show all
          </button>
        </div>
      )}

      {/* Main visualization */}
      <div className="gaps-main">
        <div className={`gaps-viz ${selected ? "has-detail" : ""}`}>
          {skills.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
              Add some skills and set proficiencies — gap analysis will fill in here.
            </div>
          ) : view === "bubble" ? (
            <BubbleView skills={filtered} selected={selected} onSelect={setSelected} />
          ) : view === "domain" ? (
            <DomainView skills={filtered} onSelect={setSelected} />
          ) : (
            <TableView skills={filtered} selected={selected} onSelect={setSelected} />
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="gaps-detail">
            <DetailPanel skill={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Bubble Map ──────────────────────────────────────────────────────────────

function BubbleView({ skills, selected, onSelect }) {
  const maxKnown = Math.max(...skills.map((s) => s.total_known), 1);

  // Group by domain for spatial clustering
  const grouped = useMemo(() => {
    const map = {};
    for (const s of skills) {
      if (!map[s.domain]) map[s.domain] = [];
      map[s.domain].push(s);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [skills]);

  return (
    <div className="bubble-map">
      {grouped.map(([domain, items]) => (
        <div key={domain} className="bubble-cluster">
          <div className="bubble-domain-label">{domain}</div>
          <div className="bubble-row">
            {items.map((s) => {
              const size = 36 + (s.total_known / maxKnown) * 48;
              const color = s.bus_factor === 0 ? "var(--bad)" : s.bus_factor === 1 ? "var(--warn)" : "var(--good)";
              const isSelected = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  className={`bubble ${isSelected ? "selected" : ""}`}
                  style={{
                    width: size,
                    height: size,
                    background: color,
                    opacity: isSelected ? 1 : 0.75,
                  }}
                  onClick={() => onSelect(isSelected ? null : s)}
                  title={`${s.name}: bus factor ${s.bus_factor}, ${s.total_known} know it`}
                >
                  <span className="bubble-label">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Domain Bars ─────────────────────────────────────────────────────────────

function DomainView({ skills, onSelect }) {
  const domains = useMemo(() => {
    const map = {};
    for (const s of skills) {
      if (!map[s.domain]) map[s.domain] = { critical: [], high: [], healthy: [] };
      if (s.bus_factor === 0) map[s.domain].critical.push(s);
      else if (s.bus_factor === 1) map[s.domain].high.push(s);
      else map[s.domain].healthy.push(s);
    }
    return Object.entries(map).sort(
      (a, b) => (b[1].critical.length + b[1].high.length) - (a[1].critical.length + a[1].high.length)
    );
  }, [skills]);

  const maxTotal = Math.max(...domains.map(([, d]) => d.critical.length + d.high.length + d.healthy.length), 1);

  return (
    <div className="domain-bars">
      {domains.map(([domain, info]) => {
        const total = info.critical.length + info.high.length + info.healthy.length;
        return (
          <div key={domain} className="domain-bar-row">
            <div className="domain-bar-label">
              <span className="domain-bar-name">{domain}</span>
              <span className="domain-bar-count">{info.critical.length + info.high.length} at risk / {total}</span>
            </div>
            <div className="domain-bar-track" style={{ width: `${(total / maxTotal) * 100}%`, minWidth: 80 }}>
              {info.critical.map((s) => (
                <button key={s.id} className="domain-bar-seg critical" style={{ flex: 1 }} onClick={() => onSelect(s)} title={s.name}>
                  <span>{s.name}</span>
                </button>
              ))}
              {info.high.map((s) => (
                <button key={s.id} className="domain-bar-seg warn" style={{ flex: 1 }} onClick={() => onSelect(s)} title={s.name}>
                  <span>{s.name}</span>
                </button>
              ))}
              {info.healthy.map((s) => (
                <button key={s.id} className="domain-bar-seg good" style={{ flex: 1 }} onClick={() => onSelect(s)} title={s.name}>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Table View ──────────────────────────────────────────────────────────────

function TableView({ skills, selected, onSelect }) {
  const [sortCol, setSortCol] = useState("bus_factor");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...skills].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortCol === "name") return mul * a.name.localeCompare(b.name);
      if (sortCol === "domain") return mul * a.domain.localeCompare(b.domain);
      return mul * ((a[sortCol] ?? 0) - (b[sortCol] ?? 0));
    });
  }, [skills, sortCol, sortDir]);

  const SortHead = ({ col, children }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children} {sortCol === col && <span>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  return (
    <div className="gaps-table-wrap">
      <table className="gaps-table">
        <thead>
          <tr>
            <SortHead col="name">Skill</SortHead>
            <SortHead col="domain">Domain</SortHead>
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
              <td><span className="domain-tag">{s.domain}</span></td>
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
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ skill: s, onClose }) {
  const color = riskColor(s.bus_factor);
  const pct = s.total_known > 0 ? Math.round((s.bus_factor / s.total_known) * 100) : 0;

  return (
    <div className="card gaps-detail-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.domain}</div>
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

      {/* Insight */}
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
            {s.total_known - s.bus_factor} other{s.total_known - s.bus_factor > 1 ? "s" : ""} know this skill at a lower level — potential upskilling candidates.
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
