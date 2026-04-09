import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const LEVEL_LABELS = { 1: "Novice", 2: "Beginner", 3: "Competent", 4: "Proficient", 5: "Expert" };

const DOMAIN_CLASS = (d) => {
  const slug = (d || "other").toLowerCase().replace(/\s+/g, "-");
  return `domain-${["databases","cloud","languages","tools"].includes(slug) ? slug : "other"}`;
};

export default function Matrix() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [domain, setDomain] = useState("all");
  const [editing, setEditing] = useState(null); // { person, skill, current }

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
          <p>Every person, every skill. Click any cell to record proficiency — yours, or anyone's if you're an admin.</p>
        </div>
      </div>

      <div className="matrix-frame">
        <div className="matrix-toolbar">
          <div className="left">
            <span style={{ fontSize: 12, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Filter by domain</span>
            <div className="domain-filter">
              <button className={domain === "all" ? "active" : ""} onClick={() => setDomain("all")}>All ({data.skills.length})</button>
              {domains.map((d) => (
                <button key={d} className={domain === d ? "active" : ""} onClick={() => setDomain(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{data.people.length} people · {visibleSkills.length} skills</div>
        </div>

        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th style={{ width: 280 }}>Person</th>
                {visibleSkills.map((s) => (
                  <th key={s.id} className="skill-h">
                    <span className="skill-name">{s.name}</span>
                    <span className="skill-domain">{s.domain}</span>
                    <span className={`domain-bar ${DOMAIN_CLASS(s.domain)}`} />
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
              {!data.people.length && (
                <tr><td colSpan={visibleSkills.length + 1} style={{ padding: 48, textAlign: "center", color: "var(--ink-mute)" }}>No people yet — add some on the People page.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="matrix-legend">
          <span>Proficiency</span>
          <div className="swatch-row"><div className="swatch matrix-cell l1" style={{ width: 18, height: 18 }} /> Novice</div>
          <div className="swatch-row"><div className="swatch matrix-cell l2" style={{ width: 18, height: 18 }} /> Beginner</div>
          <div className="swatch-row"><div className="swatch matrix-cell l3" style={{ width: 18, height: 18 }} /> Competent</div>
          <div className="swatch-row"><div className="swatch matrix-cell l4" style={{ width: 18, height: 18 }} /> Proficient</div>
          <div className="swatch-row"><div className="swatch matrix-cell l5" style={{ width: 18, height: 18 }} /> Expert</div>
          <div style={{ marginLeft: "auto", color: "var(--ink-mute)" }}>Click any cell you can edit to set a level.</div>
        </div>
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
          <button className="btn small" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
