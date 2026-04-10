import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const LEVEL_LABELS = { 1: "Novice", 2: "Beginner", 3: "Competent", 4: "Proficient", 5: "Expert" };

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
  { key: "radar", label: "Radar" },
  { key: "spread", label: "Spread" },
  { key: "gap", label: "Gap analysis" },
  { key: "grid", label: "Edit grid" },
];

export default function Matrix() {
  const { user } = useAuth();
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [source, setSource] = useState("skills");
  const [group, setGroup] = useState("all");
  const [view, setView] = useState("radar");
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
        ) : view === "radar" ? (
          <RadarChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} hoveredPerson={hoveredPerson} setHoveredPerson={setHoveredPerson} />
        ) : view === "spread" ? (
          <SpreadChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} />
        ) : view === "gap" ? (
          <GapChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} />
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

// ─── Radar Chart ────────────────────────────────────────────────────────────

function RadarChart({ people, items, cells, cellKey, hoveredPerson, setHoveredPerson }) {
  const SIZE = 500;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R = SIZE * 0.34;
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
      <div className="radar-center-wrap">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="matrix-svg radar-svg">
          {/* Grid rings */}
          {[1, 2, 3, 4, 5].map((lv) => {
            const pts = Array.from({ length: n }, (_, i) => polar(i, lv));
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
            return (
              <g key={lv}>
                <path d={d} fill="none" className="grid-line" />
                <text x={cx + 6} y={cy - (lv / maxLevel) * R + 3} className="axis-label" style={{ fontSize: 9 }}>{lv}</text>
              </g>
            );
          })}

          {/* Axis spokes + labels */}
          {items.map((s, i) => {
            const end = polar(i, maxLevel);
            const label = polar(i, maxLevel + 0.8);
            return (
              <g key={s.id}>
                <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="grid-line" />
                <text
                  x={label.x} y={label.y}
                  className="axis-label"
                  textAnchor={label.x < cx - 10 ? "end" : label.x > cx + 10 ? "start" : "middle"}
                  dominantBaseline={label.y < cy - 10 ? "auto" : label.y > cy + 10 ? "hanging" : "middle"}
                  style={{ fontSize: 10 }}
                >
                  {s.name.length > 18 ? s.name.slice(0, 16) + "\u2026" : s.name}
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
              <g key={pi} style={{ opacity: isDimmed ? 0.12 : 1, transition: "opacity 0.2s ease" }}>
                <path d={d} fill={pal.fill} stroke={pal.stroke} strokeWidth={isHovered ? 2.5 : 1.5} strokeLinejoin="round" />
                {pts.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={isHovered ? 4.5 : 3} fill={pal.stroke} stroke="var(--paper-card)" strokeWidth={1.5} className="data-dot">
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

// ─── Spread Chart: lollipop showing range + individual dots per skill ───────

function SpreadChart({ people, items, cells, cellKey }) {
  const W = 900, H = Math.max(300, items.length * 44 + 60);
  const PAD = { top: 20, right: 40, bottom: 20, left: 170 };
  const plotW = W - PAD.left - PAD.right;
  const rowH = items.length > 0 ? (H - PAD.top - PAD.bottom) / items.length : 40;
  const maxLevel = 5;

  if (items.length === 0) return <EmptyChart />;

  const xScale = (v) => PAD.left + (v / maxLevel) * plotW;

  return (
    <div className="matrix-viz-wrap">
      <PersonLegend people={people} hovered={null} onHover={() => {}} />
      <div className="matrix-viz-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg">
          {/* Vertical grid */}
          {[1, 2, 3, 4, 5].map((lv) => (
            <g key={lv}>
              <line x1={xScale(lv)} y1={PAD.top} x2={xScale(lv)} y2={H - PAD.bottom} className="grid-line" />
              <text x={xScale(lv)} y={PAD.top - 6} className="axis-label" textAnchor="middle">{lv}</text>
            </g>
          ))}

          {items.map((s, si) => {
            const cy = PAD.top + si * rowH + rowH / 2;
            const levels = people.map((p) => cells[cellKey(p.id, s.id)] || 0);
            const nonZero = levels.filter(Boolean);
            const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;
            const max = nonZero.length > 0 ? Math.max(...nonZero) : 0;
            const avg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
            const spread = max - min;

            return (
              <g key={s.id}>
                {/* Row background on hover */}
                <rect x={PAD.left} y={cy - rowH / 2} width={plotW} height={rowH} fill="transparent" className="spread-row-bg" />

                {/* Skill label */}
                <text x={PAD.left - 12} y={cy + 4} className="axis-label" textAnchor="end" style={{ fontSize: 11, fontWeight: 500 }}>
                  {s.name.length > 22 ? s.name.slice(0, 20) + "\u2026" : s.name}
                </text>

                {/* Range bar (min to max) */}
                {nonZero.length > 1 && (
                  <rect
                    x={xScale(min)} y={cy - 4}
                    width={Math.max(xScale(max) - xScale(min), 2)} height={8}
                    rx={4}
                    fill={spread >= 3 ? "rgba(224,115,74,0.2)" : spread >= 2 ? "rgba(212,160,50,0.15)" : "rgba(108,123,255,0.1)"}
                    stroke={spread >= 3 ? "rgba(224,115,74,0.4)" : spread >= 2 ? "rgba(212,160,50,0.3)" : "rgba(108,123,255,0.2)"}
                    strokeWidth={1}
                  />
                )}

                {/* Average marker */}
                {avg > 0 && (
                  <line x1={xScale(avg)} y1={cy - 10} x2={xScale(avg)} y2={cy + 10} stroke="var(--ink-mute)" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.5} />
                )}

                {/* Person dots */}
                {people.map((p, pi) => {
                  const lvl = cells[cellKey(p.id, s.id)] || 0;
                  if (lvl === 0) return null;
                  const pal = PALETTE[pi % PALETTE.length];
                  return (
                    <circle
                      key={p.id}
                      cx={xScale(lvl)}
                      cy={cy + (pi - (people.length - 1) / 2) * 3}
                      r={5}
                      fill={pal.stroke}
                      stroke="var(--paper-card)"
                      strokeWidth={2}
                      className="data-dot"
                      opacity={0.9}
                    >
                      <title>{p.name}: {LEVEL_LABELS[lvl]} ({lvl}/5)</title>
                    </circle>
                  );
                })}

                {/* Spread indicator on far right */}
                {nonZero.length > 1 && (
                  <text x={W - PAD.right + 8} y={cy + 4} style={{ fontSize: 9, fontWeight: 600 }}
                    fill={spread >= 3 ? "#e0734a" : spread >= 2 ? "#d4a032" : "var(--ink-mute)"}
                  >
                    {spread > 0 ? `\u0394${spread}` : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Gap Analysis Chart: butterfly/tornado showing who's strong where ───────

function GapChart({ people, items, cells, cellKey }) {
  if (people.length < 2) return <EmptyChart message="Need at least 2 people for gap analysis." />;

  const W = 900, H = Math.max(300, items.length * 40 + 60);
  const CENTER = W / 2;
  const PAD = { top: 40, bottom: 20 };
  const barMaxW = (W - 80) / 2 - 20;
  const rowH = items.length > 0 ? (H - PAD.top - PAD.bottom) / items.length : 40;
  const maxLevel = 5;

  // Compare first two people (or selected vs team average)
  const p1 = people[0], p2 = people[1];
  const pal1 = PALETTE[0], pal2 = PALETTE[1];

  return (
    <div className="matrix-viz-wrap">
      <div className="viz-legend">
        <span className="viz-legend-item">
          <span className="viz-legend-dot" style={{ background: pal1.stroke }} />
          {p1.name}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-mute)", padding: "0 8px" }}>vs</span>
        <span className="viz-legend-item">
          <span className="viz-legend-dot" style={{ background: pal2.stroke }} />
          {p2.name}
        </span>
      </div>
      <div className="matrix-viz-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg">
          {/* Center axis */}
          <line x1={CENTER} y1={PAD.top - 20} x2={CENTER} y2={H - PAD.bottom} stroke="var(--line)" strokeWidth={1} />

          {/* Column headers */}
          <text x={CENTER - barMaxW / 2} y={PAD.top - 8} className="axis-label" textAnchor="middle" style={{ fontSize: 11, fontWeight: 600 }}>
            {p1.name}
          </text>
          <text x={CENTER + barMaxW / 2} y={PAD.top - 8} className="axis-label" textAnchor="middle" style={{ fontSize: 11, fontWeight: 600 }}>
            {p2.name}
          </text>

          {items.map((s, si) => {
            const cy = PAD.top + si * rowH + rowH / 2;
            const lvl1 = cells[cellKey(p1.id, s.id)] || 0;
            const lvl2 = cells[cellKey(p2.id, s.id)] || 0;
            const w1 = (lvl1 / maxLevel) * barMaxW;
            const w2 = (lvl2 / maxLevel) * barMaxW;
            const gap = Math.abs(lvl1 - lvl2);

            return (
              <g key={s.id}>
                <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" className="spread-row-bg" />

                {/* Left bar (person 1 — extends left from center) */}
                <rect
                  x={CENTER - w1} y={cy - 10}
                  width={Math.max(w1, 0)} height={20}
                  rx={4}
                  fill={pal1.fill}
                  stroke={pal1.stroke}
                  strokeWidth={1.5}
                  style={{ transition: "all 0.3s ease" }}
                />
                {lvl1 > 0 && (
                  <text x={CENTER - w1 - 6} y={cy + 4} fill={pal1.stroke} style={{ fontSize: 11, fontWeight: 700 }} textAnchor="end">{lvl1}</text>
                )}

                {/* Right bar (person 2 — extends right from center) */}
                <rect
                  x={CENTER} y={cy - 10}
                  width={Math.max(w2, 0)} height={20}
                  rx={4}
                  fill={pal2.fill}
                  stroke={pal2.stroke}
                  strokeWidth={1.5}
                  style={{ transition: "all 0.3s ease" }}
                />
                {lvl2 > 0 && (
                  <text x={CENTER + w2 + 6} y={cy + 4} fill={pal2.stroke} style={{ fontSize: 11, fontWeight: 700 }} textAnchor="start">{lvl2}</text>
                )}

                {/* Skill name at center */}
                <text x={CENTER} y={cy + 4} className="axis-label" textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 600, fill: "var(--ink-soft)" }}
                >
                  {s.name.length > 20 ? s.name.slice(0, 18) + "\u2026" : s.name}
                </text>

                {/* Gap indicator */}
                {gap >= 2 && (
                  <circle cx={CENTER} cy={cy - rowH / 2 + 4} r={3}
                    fill={gap >= 3 ? "#e0734a" : "#d4a032"} opacity={0.8}
                  >
                    <title>Gap of {gap} levels</title>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────────────

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
