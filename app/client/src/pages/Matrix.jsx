import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const LEVEL_LABELS = { 1: "Novice", 2: "Beginner", 3: "Competent", 4: "Proficient", 5: "Expert" };

const VIEWS = [
  { key: "chart", label: "Chart" },
  { key: "heatmap", label: "Heatmap" },
  { key: "grid", label: "Edit grid" },
];

export default function Matrix() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [domain, setDomain] = useState("all");
  const [view, setView] = useState("chart");
  const [editing, setEditing] = useState(null);

  const reload = () => api.matrix().then(setData).catch(() => {});
  useEffect(() => { reload(); }, []);

  const domains = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.skills.map((s) => s.domain))).sort();
  }, [data]);

  const visibleSkills = useMemo(() => {
    if (!data) return [];
    return domain === "all" ? data.skills : data.skills.filter((s) => s.domain === domain);
  }, [data, domain]);

  if (!data) return <span className="loader"><span /><span /><span /></span>;

  const canEdit = (person) => user.role === "admin" || person.id === user.id;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Skill matrix</h1>
          <p>Visualize and manage your team's proficiency across every skill.</p>
        </div>
      </div>

      <div className="matrix-frame">
        <div className="matrix-toolbar">
          <div className="left">
            <div className="domain-filter">
              <button className={domain === "all" ? "active" : ""} onClick={() => setDomain("all")}>All ({data.skills.length})</button>
              {domains.map((d) => (
                <button key={d} className={domain === d ? "active" : ""} onClick={() => setDomain(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{data.people.length} people · {visibleSkills.length} skills</span>
            <div className="gaps-view-toggle">
              {VIEWS.map((v) => (
                <button key={v.key} className={`gaps-view-btn ${view === v.key ? "active" : ""}`} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "chart" && (
          <ChartView data={data} skills={visibleSkills} />
        )}

        {view === "heatmap" && (
          <HeatmapView data={data} skills={visibleSkills} />
        )}

        {view === "grid" && (
          <>
            <div className="matrix-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: 280 }}>Person</th>
                    {visibleSkills.map((s) => (
                      <th key={s.id} className="skill-h">
                        <span className="skill-name">{s.name}</span>
                        <span className="skill-domain">{s.domain}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
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
                      {visibleSkills.map((s) => {
                        const lvl = data.cells[`${p.id}:${s.id}`];
                        return (
                          <td key={s.id} className="cell">
                            <div
                              className={`matrix-cell ${lvl ? `l${lvl}` : "empty"}`}
                              title={lvl ? `${p.name} · ${s.name} · ${LEVEL_LABELS[lvl]}` : `${p.name} · ${s.name}`}
                              onClick={() => canEdit(p) && setEditing({ person: p, skill: s, current: lvl })}
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
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

// ─── Bar Chart: per-skill grouped bars showing each person's level ──────────

function ChartView({ data, skills }) {
  const [mode, setMode] = useState("by-skill"); // by-skill | by-person
  const maxLevel = 5;

  if (mode === "by-person") {
    return (
      <div className="matrix-chart">
        <div className="matrix-chart-header">
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
        <div className="chart-rows">
          {data.people.map((p) => (
            <div key={p.id} className="chart-group">
              <div className="chart-group-label">{p.name}</div>
              <div className="chart-bars">
                {skills.map((s) => {
                  const lvl = data.cells[`${p.id}:${s.id}`] || 0;
                  return (
                    <div key={s.id} className="chart-bar-wrap" title={`${s.name}: ${lvl ? LEVEL_LABELS[lvl] : "None"}`}>
                      <div className="chart-bar-track">
                        <div
                          className={`chart-bar-fill ${lvl ? `l${lvl}` : ""}`}
                          style={{ height: `${(lvl / maxLevel) * 100}%` }}
                        />
                      </div>
                      <div className="chart-bar-label">{s.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // by-skill (default): each skill shows grouped bars per person
  return (
    <div className="matrix-chart">
      <div className="matrix-chart-header">
        <ModeToggle mode={mode} setMode={setMode} />
        <div className="chart-person-legend">
          {data.people.map((p, i) => (
            <span key={p.id} className="chart-person-chip" style={{ borderColor: personColor(i) }}>
              <span className="chart-person-dot" style={{ background: personColor(i) }} />
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-skill-rows">
        {skills.map((s) => (
          <div key={s.id} className="chart-skill-row">
            <div className="chart-skill-info">
              <span className="chart-skill-name">{s.name}</span>
              <span className="chart-skill-domain">{s.domain}</span>
            </div>
            <div className="chart-skill-bars">
              {data.people.map((p, i) => {
                const lvl = data.cells[`${p.id}:${s.id}`] || 0;
                return (
                  <div key={p.id} className="chart-h-bar" title={`${p.name}: ${lvl ? LEVEL_LABELS[lvl] : "None"} (${lvl}/5)`}>
                    <div
                      className="chart-h-bar-fill"
                      style={{ width: `${(lvl / maxLevel) * 100}%`, background: personColor(i) }}
                    />
                    <span className="chart-h-bar-value">{lvl || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div className="gaps-view-toggle" style={{ alignSelf: "flex-start" }}>
      <button className={`gaps-view-btn ${mode === "by-skill" ? "active" : ""}`} onClick={() => setMode("by-skill")}>By skill</button>
      <button className={`gaps-view-btn ${mode === "by-person" ? "active" : ""}`} onClick={() => setMode("by-person")}>By person</button>
    </div>
  );
}

// ─── Heatmap: compact colored grid with numbers ─────────────────────────────

function HeatmapView({ data, skills }) {
  return (
    <div className="matrix-heatmap">
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th></th>
              {skills.map((s) => (
                <th key={s.id} title={`${s.name} (${s.domain})`}>
                  <span className="heatmap-skill-label">{s.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id}>
                <td className="heatmap-person">{p.name}</td>
                {skills.map((s) => {
                  const lvl = data.cells[`${p.id}:${s.id}`] || 0;
                  return (
                    <td key={s.id}>
                      <div className={`heatmap-cell ${lvl ? `l${lvl}` : "empty"}`}>
                        {lvl || ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Averages row */}
            <tr className="heatmap-avg-row">
              <td className="heatmap-person" style={{ fontWeight: 700 }}>Avg</td>
              {skills.map((s) => {
                const levels = data.people.map((p) => data.cells[`${p.id}:${s.id}`] || 0).filter(Boolean);
                const avg = levels.length > 0 ? (levels.reduce((a, b) => a + b, 0) / levels.length) : 0;
                const roundedClass = avg >= 4 ? "l5" : avg >= 3 ? "l4" : avg >= 2 ? "l3" : avg > 0 ? "l2" : "empty";
                return (
                  <td key={s.id}>
                    <div className={`heatmap-cell ${roundedClass}`} style={{ fontWeight: 700 }}>
                      {avg > 0 ? avg.toFixed(1) : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="matrix-legend" style={{ marginTop: 16 }}>
        <span>Proficiency</span>
        {[1, 2, 3, 4, 5].map((lv) => (
          <div key={lv} className="swatch-row">
            <div className={`swatch matrix-cell l${lv}`} style={{ width: 18, height: 18 }} />
            {LEVEL_LABELS[lv]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function ProficiencyEditor({ editing, onClose, onSaved }) {
  const [level, setLevel] = useState(editing.current || 3);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.setProficiency({ user_id: editing.person.id, skill_id: editing.skill.id, level });
      onSaved();
    } catch { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing.skill.name}</h2>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERSON_COLORS = ["#4d65ff", "#b8482e", "#5b8a5b", "#b8862e", "#7b5ea7", "#2e8a8a", "#c45d8a", "#6b8a2e"];
function personColor(index) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}
