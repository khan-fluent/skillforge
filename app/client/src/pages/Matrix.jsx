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
  { key: "gap", label: "Gap analysis" },
  { key: "parallel", label: "Parallel" },
];

export default function Matrix() {
  const [skillsData, setSkillsData] = useState(null);
  const [domainsData, setDomainsData] = useState(null);
  const [source, setSource] = useState("skills");
  const [group, setGroup] = useState("all");
  const [view, setView] = useState("radar");
  const [hoveredPerson, setHoveredPerson] = useState(null);

  useEffect(() => {
    api.matrix().then(setSkillsData).catch(() => {});
    api.domainMatrix().then(setDomainsData).catch(() => {});
  }, []);

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

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Matrix</h1>
          <p>Visualize your team's proficiency across every {source === "skills" ? "skill" : "domain"}.</p>
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
        ) : view === "gap" ? (
          <GapChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} />
        ) : (
          <ParallelChart people={people} items={visibleItems} cells={cells} cellKey={cellKey} hoveredPerson={hoveredPerson} setHoveredPerson={setHoveredPerson} />
        )}
      </div>
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

  return (
    <div className="matrix-viz-wrap">
      <PersonLegend people={people} hovered={hoveredPerson} onHover={setHoveredPerson} />
      <div className="radar-center-wrap">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="matrix-svg radar-svg">
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

          {items.map((s, i) => {
            const end = polar(i, maxLevel);
            const label = polar(i, maxLevel + 0.8);
            return (
              <g key={s.id}>
                <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="grid-line" />
                <text x={label.x} y={label.y} className="axis-label"
                  textAnchor={label.x < cx - 10 ? "end" : label.x > cx + 10 ? "start" : "middle"}
                  dominantBaseline={label.y < cy - 10 ? "auto" : label.y > cy + 10 ? "hanging" : "middle"}
                  style={{ fontSize: 10 }}
                >{s.name.length > 18 ? s.name.slice(0, 16) + "\u2026" : s.name}</text>
              </g>
            );
          })}

          {people.map((p, pi) => {
            const pal = PALETTE[pi % PALETTE.length];
            const pts = items.map((s, i) => polar(i, cells[cellKey(p.id, s.id)] || 0));
            const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ") + " Z";
            const isHovered = hoveredPerson === pi;
            const isDimmed = hoveredPerson !== null && !isHovered;
            return (
              <g key={pi} style={{ opacity: isDimmed ? 0.12 : 1, transition: "opacity 0.2s ease" }}>
                <path d={d} fill={pal.fill} stroke={pal.stroke} strokeWidth={isHovered ? 2.5 : 1.5} strokeLinejoin="round" />
                {pts.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={isHovered ? 4.5 : 3} fill={pal.stroke} stroke="var(--paper-card)" strokeWidth={1.5} className="data-dot">
                    <title>{p.name} — {items[i].name}: {cells[cellKey(p.id, items[i].id)] || 0}/5</title>
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

// ─── Gap Analysis: person picker + butterfly chart ──────────────────────────

function GapChart({ people, items, cells, cellKey }) {
  const [leftId, setLeftId] = useState("avg");
  const [rightId, setRightId] = useState(people.length > 0 ? String(people[0].id) : "avg");

  if (people.length === 0 || items.length === 0) return <EmptyChart />;

  // Default: first load pick person 1 left, person 2 or avg right
  const getLeft = () => leftId === "avg" ? null : people.find((p) => String(p.id) === leftId);
  const getRight = () => rightId === "avg" ? null : people.find((p) => String(p.id) === rightId);

  const teamAvg = (skillId) => {
    const levels = people.map((p) => cells[cellKey(p.id, skillId)] || 0).filter(Boolean);
    return levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  };

  const leftPerson = getLeft();
  const rightPerson = getRight();
  const leftLabel = leftPerson ? leftPerson.name : "Team average";
  const rightLabel = rightPerson ? rightPerson.name : "Team average";
  const leftLevel = (sId) => leftPerson ? (cells[cellKey(leftPerson.id, sId)] || 0) : teamAvg(sId);
  const rightLevel = (sId) => rightPerson ? (cells[cellKey(rightPerson.id, sId)] || 0) : teamAvg(sId);

  const pal1 = PALETTE[0], pal2 = PALETTE[1];

  const W = 900, H = Math.max(280, items.length * 38 + 70);
  const CENTER = W / 2;
  const PAD = { top: 50, bottom: 20 };
  const barMaxW = (W - 100) / 2 - 20;
  const rowH = (H - PAD.top - PAD.bottom) / items.length;
  const maxLevel = 5;

  return (
    <div className="matrix-viz-wrap">
      <div className="gap-picker">
        <select className="input gap-select" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
          <option value="avg">Team average</option>
          {people.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <span className="gap-vs">vs</span>
        <select className="input gap-select" value={rightId} onChange={(e) => setRightId(e.target.value)}>
          <option value="avg">Team average</option>
          {people.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>
      <div className="matrix-viz-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg">
          <line x1={CENTER} y1={PAD.top - 10} x2={CENTER} y2={H - PAD.bottom} stroke="var(--line)" strokeWidth={1} />

          <text x={CENTER - barMaxW / 2} y={PAD.top - 16} className="axis-label" textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: pal1.stroke }}>{leftLabel}</text>
          <text x={CENTER + barMaxW / 2} y={PAD.top - 16} className="axis-label" textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: pal2.stroke }}>{rightLabel}</text>

          {items.map((s, si) => {
            const cy = PAD.top + si * rowH + rowH / 2;
            const lv1 = leftLevel(s.id);
            const lv2 = rightLevel(s.id);
            const w1 = (lv1 / maxLevel) * barMaxW;
            const w2 = (lv2 / maxLevel) * barMaxW;
            const gap = Math.abs(lv1 - lv2);

            return (
              <g key={s.id}>
                <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" className="spread-row-bg" />

                <rect x={CENTER - w1} y={cy - 9} width={Math.max(w1, 0)} height={18} rx={4}
                  fill={pal1.fill} stroke={pal1.stroke} strokeWidth={1.5} style={{ transition: "all 0.3s ease" }} />
                {lv1 > 0 && <text x={CENTER - w1 - 6} y={cy + 4} fill={pal1.stroke} style={{ fontSize: 10, fontWeight: 700 }} textAnchor="end">{Number.isInteger(lv1) ? lv1 : lv1.toFixed(1)}</text>}

                <rect x={CENTER} y={cy - 9} width={Math.max(w2, 0)} height={18} rx={4}
                  fill={pal2.fill} stroke={pal2.stroke} strokeWidth={1.5} style={{ transition: "all 0.3s ease" }} />
                {lv2 > 0 && <text x={CENTER + w2 + 6} y={cy + 4} fill={pal2.stroke} style={{ fontSize: 10, fontWeight: 700 }} textAnchor="start">{Number.isInteger(lv2) ? lv2 : lv2.toFixed(1)}</text>}

                <text x={CENTER} y={cy + 4} className="axis-label" textAnchor="middle" style={{ fontSize: 9, fontWeight: 600, fill: "var(--ink-soft)" }}>
                  {s.name.length > 18 ? s.name.slice(0, 16) + "\u2026" : s.name}
                </text>

                {gap >= 2 && (
                  <circle cx={W - 16} cy={cy} r={4} fill={gap >= 3 ? "#e0734a" : "#d4a032"} opacity={0.85}>
                    <title>Gap: {gap.toFixed(1)} levels</title>
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

// ─── Parallel Coordinates: vertical axes per skill, lines per person ────────

function ParallelChart({ people, items, cells, cellKey, hoveredPerson, setHoveredPerson }) {
  const W = Math.max(700, items.length * 80 + 80);
  const H = 380;
  const PAD = { top: 40, right: 40, bottom: 60, left: 40 };
  const plotH = H - PAD.top - PAD.bottom;
  const maxLevel = 5;
  const n = items.length;

  if (n === 0) return <EmptyChart />;

  const xStep = n > 1 ? (W - PAD.left - PAD.right) / (n - 1) : 0;
  const yScale = (v) => PAD.top + plotH - (v / maxLevel) * plotH;

  return (
    <div className="matrix-viz-wrap">
      <PersonLegend people={people} hovered={hoveredPerson} onHover={setHoveredPerson} />
      <div className="matrix-viz-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="matrix-svg">
          {/* Vertical axes */}
          {items.map((s, i) => {
            const x = PAD.left + i * xStep;
            return (
              <g key={s.id}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH} stroke="var(--line)" strokeWidth={1} opacity={0.4} />
                {[1, 2, 3, 4, 5].map((lv) => (
                  <g key={lv}>
                    <line x1={x - 3} y1={yScale(lv)} x2={x + 3} y2={yScale(lv)} stroke="var(--ink-mute)" strokeWidth={1} opacity={0.4} />
                    {i === 0 && <text x={x - 10} y={yScale(lv) + 3} className="axis-label" textAnchor="end" style={{ fontSize: 9 }}>{lv}</text>}
                  </g>
                ))}
                <text x={x} y={H - PAD.bottom + 18} className="axis-label" textAnchor="middle"
                  style={{ fontSize: 9, fontWeight: 500 }}
                  transform={n > 8 ? `rotate(-40, ${x}, ${H - PAD.bottom + 18})` : undefined}
                >
                  {s.name.length > 14 ? s.name.slice(0, 12) + "\u2026" : s.name}
                </text>
              </g>
            );
          })}

          {/* Person lines */}
          {people.map((p, pi) => {
            const pal = PALETTE[pi % PALETTE.length];
            const points = items.map((s, i) => ({
              x: PAD.left + i * xStep,
              y: yScale(cells[cellKey(p.id, s.id)] || 0),
            }));
            const isHovered = hoveredPerson === pi;
            const isDimmed = hoveredPerson !== null && !isHovered;

            // Smooth curve through points
            const path = points.length === 1
              ? `M${points[0].x},${points[0].y}`
              : points.map((pt, i) => {
                  if (i === 0) return `M${pt.x},${pt.y}`;
                  const prev = points[i - 1];
                  const cpx = (prev.x + pt.x) / 2;
                  return `C${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
                }).join(" ");

            return (
              <g key={pi} style={{ opacity: isDimmed ? 0.1 : 1, transition: "opacity 0.2s ease" }}>
                <path d={path} fill="none" stroke={pal.stroke} strokeWidth={isHovered ? 3 : 2} strokeLinecap="round" />
                {points.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={isHovered ? 5 : 3.5} fill={pal.stroke} stroke="var(--paper-card)" strokeWidth={2} className="data-dot">
                    <title>{p.name} — {items[i].name}: {cells[cellKey(p.id, items[i].id)] || 0}/5</title>
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

// ─── Shared ─────────────────────────────────────────────────────────────────

function PersonLegend({ people, hovered, onHover }) {
  return (
    <div className="viz-legend">
      {people.map((p, i) => {
        const pal = PALETTE[i % PALETTE.length];
        const isActive = hovered === null || hovered === i;
        return (
          <button key={p.id} className={`viz-legend-item ${isActive ? "" : "dimmed"}`}
            onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}
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
