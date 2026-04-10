import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const LEVEL_LABELS = { 1: "Novice", 2: "Beginner", 3: "Competent", 4: "Proficient", 5: "Expert" };

// Rich palette that works on both light and dark — translucent fills, solid strokes
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

const VIEWS = [
  { key: "area", label: "Area chart" },
  { key: "radar", label: "Radar" },
  { key: "grid", label: "Edit grid" },
];

export default function Matrix() {
  const { user } = useAuth();
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [source, setSource] = useState("skills");
  const [group, setGroup] = useState("all");
  const [view, setView] = useState("area");
  const [editing, setEditing] = useState(null);
  const [hoveredPerson, setHoveredPerson] = useState(null);

  const reloadSkills = () => api.matrix().then(setSkillsData).catch(() => {});
  const reloadDomains = () => api.domainMatrix().then(setDomainsData).catch(() => {});
  useEffect(() => { reloadSkills(); reloadDomains(); }, []);

  const reload = () => { if (source === "skills") reloadSkills(); else reloadDomains(); };

  const data = source === "skills" ? skillsData : domainsData;
  const people = data?.people || data?.members || [];
  const items = data?.skills || data?.domains || [];
  const cells = data?.cells || data?.proficiencies || {};
  const cellKey = (pid, sid) => source === "skills" ? `${pid}:${sid}` : `${pid}-${sid}`;

  const groups = useMemo(() => {
    const set = new Set(items.map((s) => s.domain || s.category || "general"));
    return [...set].sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    return group === "all" ? items : items.filter((s) => (s.domain || s.category) === group);
  }, [items, group]);

  useEffect(() => { setGroup("all"); }, [source]);

  if (!skillsData && !domainsData) return <span className="loader"><span /><span /><span /></span>;

  const canEdit = (person) => user.role === "admin" || person.id === user.id;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Matrix</h1>
          <p>Visualize and manage your team's proficiency across every {source === "skills" ? "skill" : "domain"}.</p>
        </div>
      </div>

      <div className="matrix-frame">
        <div className="matrix-toolbar">
          <div className="left">
            <div className="gaps-view-toggle">
              <button className={`gaps-view-btn ${source === "skills" ? "active" : ""}`} onClick={() => setSource("skills")}>Skills</button>
              <button className={`gaps-view-btn ${source === "domains" ? "active" : ""}`} onClick={() => setSource("domains")}>Domains</button>
            </div>
            <div className="domain-filter">
              <button className={group === "all" ? "active" : ""} onClick={() => setGroup("all")}>All ({items.length})</button>
              {groups.map((g) => (
                <button key={g} className={group === g ? "active" : ""} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{people.length} people · {visibleItems.length} {source}</span>
            <div className="gaps-view-toggle">
              {VIEWS.map((v) => (
                <button key={v.key} className={`gaps-view-btn ${view === v.key ? "active" : ""}`} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!data ? (
          <div style={{ padding: 48, textAlign: "center" }}><span className="loader"><span /><span /><span /></span></div>
        ) : view === "area" ? (
          <AreaChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} hoveredPerson={hoveredPerson} setHoveredPerson={setHoveredPerson} />
        ) : view === "radar" ? (
          <RadarChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} hoveredPerson={hoveredPerson} setHoveredPerson={setHoveredPerson} />
        ) : (
          <>
            <div className="matrix-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: 280 }}>Person</th>
                    {visibleItems.map((s) => (
                      <th key={s.id} className="skill-h">
                        <span className="skill-name">{s.name}</span>
                        <span className="skill-domain">{s.domain || s.category}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td className="person">
                        <div className="person-line">
                          <div className="person-avatar">{p.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</div>
                          <div>
                            <div className="person-name">{p.name}</div>
                            <div className="person-role">{p.job_title || (p.role === "admin" ? "Admin" : "Member")}</div>
                          </div>
                        </div>
                      </td>
                      {visibleItems.map((s) => {
                        const lvl = cells[cellKey(p.id, s.id)];
                        return (
                          <td key={s.id} className="cell">
                            <div
                              className={`matrix-cell ${lvl ? `l${lvl}` : "empty"}`}
                              title={lvl ? `${p.name} · ${s.name} · ${LEVEL_LABELS[lvl]}` : `${p.name} · ${s.name}`}
                              onClick={() => canEdit(p) && setEditing({ person: p, item: s, current: lvl })}
                              style={{ cursor: canEdit(p) ? "pointer" : "default" }}
                            >
                              {lvl || (canEdit(p) ? "+" : "")}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="matrix-legend">
              <span>Proficiency</span>
              {[1, 2, 3, 4, 5].map((lv) => (
                <div key={lv} className="swatch-row">
                  <div className={`swatch matrix-cell l${lv}`} style={{ width: 18, height: 18 }} />
                  {LEVEL_LABELS[lv]}
                </div>
              ))}
              <div style={{ marginLeft: "auto", color: "var(--ink-mute)" }}>Click any cell to set a level.</div>
            </div>
          </>
        )}
      </div>

      {editing && (
        <ProficiencyEditor
          editing={editing}
          source={source}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

// ─── Area Chart (SVG) ───────────────────────────────────────────────────────

function AreaChart({ people, items, cells, cellKey, hoveredPerson, setHoveredPerson }) {
  const W = 900, H = 340, PAD = { top: 30, right: 30, bottom: 70, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxLevel = 5;

  if (items.length === 0) return <EmptyChart />;

  const xStep = items.length > 1 ? plotW / (items.length - 1) : plotW;
  const yScale = (v) => plotH - (v / maxLevel) * plotH;

  const buildPath = (personIdx) => {
    const p = people[personIdx];
    const points = items.map((s, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + yScale(cells[cellKey(p.id, s.id)] || 0);
      return { x, y };
    });
    const line = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
    const area = `${line} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;
    return { points, line, area };
  };

  return (
    <div className="matrix-viz-wrap">
      <PersonLegend people={people} hovered={hoveredPerson} onHover={setHoveredPerson} />
      <div className="matrix-viz-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg">
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map((lv) => {
            const y = PAD.top + yScale(lv);
            return (
              <g key={lv}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className="grid-line" />
                <text x={PAD.left - 10} y={y + 4} className="axis-label" textAnchor="end">{lv}</text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {items.map((s, i) => (
            <text
              key={s.id}
              x={PAD.left + i * xStep}
              y={H - PAD.bottom + 20}
              className="axis-label x-label"
              textAnchor="middle"
              transform={items.length > 6 ? `rotate(-35, ${PAD.left + i * xStep}, ${H - PAD.bottom + 20})` : undefined}
            >
              {s.name.length > 14 ? s.name.slice(0, 12) + "\u2026" : s.name}
            </text>
          ))}

          {/* Area fills + lines for each person */}
          {people.map((_, pi) => {
            const pal = PALETTE[pi % PALETTE.length];
            const { area, line, points } = buildPath(pi);
            const isHovered = hoveredPerson === pi;
            const isDimmed = hoveredPerson !== null && !isHovered;
            return (
              <g key={pi} style={{ opacity: isDimmed ? 0.15 : 1, transition: "opacity 0.2s ease" }}>
                <path d={area} fill={pal.fill} />
                <path d={line} fill="none" stroke={pal.stroke} strokeWidth={isHovered ? 3 : 2} strokeLinejoin="round" />
                {points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5 : 3.5}
                    fill={pal.stroke}
                    stroke="var(--paper-card)"
                    strokeWidth={2}
                    className="data-dot"
                  >
                    <title>{people[pi].name} — {items[i].name}: {cells[cellKey(people[pi].id, items[i].id)] || 0}/5</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Radar Chart (SVG) ──────────────────────────────────────────────────────

function RadarChart({ people, items, cells, cellKey, hoveredPerson, setHoveredPerson }) {
  const SIZE = 440;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R = SIZE * 0.38;
  const maxLevel = 5;
  const n = items.length;

  if (n < 3) return <EmptyChart message="Need at least 3 items for radar view." />;

  const angleStep = (2 * Math.PI) / n;
  const polar = (i, level) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (level / maxLevel) * R;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const buildPolygon = (personIdx) => {
    const p = people[personIdx];
    return items.map((s, i) => {
      const lvl = cells[cellKey(p.id, s.id)] || 0;
      return polar(i, lvl);
    });
  };

  return (
    <div className="matrix-viz-wrap">
      <PersonLegend people={people} hovered={hoveredPerson} onHover={setHoveredPerson} />
      <div className="matrix-viz-container" style={{ maxWidth: SIZE + 40 }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="matrix-svg radar-svg">
          {/* Grid rings */}
          {[1, 2, 3, 4, 5].map((lv) => {
            const pts = Array.from({ length: n }, (_, i) => polar(i, lv));
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
            return (
              <g key={lv}>
                <path d={d} fill="none" className="grid-line" />
                <text x={cx + 4} y={cy - (lv / maxLevel) * R + 4} className="axis-label" style={{ fontSize: 9 }}>{lv}</text>
              </g>
            );
          })}

          {/* Axis spokes + labels */}
          {items.map((s, i) => {
            const end = polar(i, maxLevel);
            const label = polar(i, maxLevel + 0.7);
            return (
              <g key={s.id}>
                <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="grid-line" />
                <text
                  x={label.x} y={label.y}
                  className="axis-label"
                  textAnchor={label.x < cx - 10 ? "end" : label.x > cx + 10 ? "start" : "middle"}
                  dominantBaseline={label.y < cy ? "auto" : "hanging"}
                  style={{ fontSize: 10 }}
                >
                  {s.name.length > 16 ? s.name.slice(0, 14) + "\u2026" : s.name}
                </text>
              </g>
            );
          })}

          {/* Person polygons */}
          {people.map((_, pi) => {
            const pal = PALETTE[pi % PALETTE.length];
            const pts = buildPolygon(pi);
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
            const isHovered = hoveredPerson === pi;
            const isDimmed = hoveredPerson !== null && !isHovered;
            return (
              <g key={pi} style={{ opacity: isDimmed ? 0.15 : 1, transition: "opacity 0.2s ease" }}>
                <path d={d} fill={pal.fill} stroke={pal.stroke} strokeWidth={isHovered ? 2.5 : 1.5} strokeLinejoin="round" />
                {pts.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 4.5 : 3}
                    fill={pal.stroke}
                    stroke="var(--paper-card)"
                    strokeWidth={1.5}
                    className="data-dot"
                  >
                    <title>{people[pi].name} — {items[i].name}: {cells[cellKey(people[pi].id, items[i].id)] || 0}/5</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Shared components ──────────────────────────────────────────────────────

function PersonLegend({ people, hovered, onHover }) {
  return (
    <div className="viz-legend">
      {people.map((p, i) => {
        const pal = PALETTE[i % PALETTE.length];
        const isActive = hovered === null || hovered === i;
        return (
          <button
            key={p.id}
            className={`viz-legend-item ${isActive ? "" : "dimmed"}`}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onHover(hovered === i ? null : i)}
          >
            <span className="viz-legend-dot" style={{ background: pal.stroke }} />
            <span className="viz-legend-line" style={{ background: pal.stroke }} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 56, color: "var(--ink-mute)" }}>
      {message || "Add some data to see the visualization."}
    </div>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────────────

function ProficiencyEditor({ editing, source, onClose, onSaved }) {
  const [level, setLevel] = useState(editing.current || 3);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (source === "skills") {
        await api.setProficiency({ user_id: editing.person.id, skill_id: editing.item.id, level });
      } else {
        await api.setDomainProf({ user_id: editing.person.id, domain_id: editing.item.id, level });
      }
      onSaved();
    } catch { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing.item.name}</h2>
        <p className="lede">Set {editing.person.name}'s proficiency.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          {[1, 2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={`matrix-cell l${lv}`}
              style={{
                width: 64, height: 64, fontSize: 18, fontWeight: 700,
                outline: level === lv ? `3px solid var(--accent)` : "none",
                outlineOffset: 3,
              }}
            >
              {lv}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Novice</span><span>Expert</span>
        </div>
        <div className="actions">
          <button className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn small" onClick={save} disabled={busy}>{busy ? "Saving\u2026" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
