import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const DOMAINS = ["databases", "cloud", "languages", "tools", "practices", "security", "data", "other"];
const LEVEL_LABELS = { 1: "Novice", 2: "Beginner", 3: "Competent", 4: "Proficient", 5: "Expert" };

export default function Skills() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // skill object or null
  const [generating, setGenerating] = useState(false);
  const [domainFilter, setDomainFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("domain");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedId, setExpandedId] = useState(null);
  const isAdmin = user.role === "admin";

  const reload = () => {
    api.skills().then(setSkills).catch(() => {});
    api.matrix().then(setMatrixData).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this skill? Proficiencies for it will also be removed.")) return;
    await api.deleteSkill(id);
    reload();
  };

  const domains = useMemo(() => {
    const set = new Set(skills.map((s) => s.domain));
    return [...set].sort();
  }, [skills]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = skills;
    if (domainFilter !== "all") list = list.filter((s) => s.domain === domainFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortCol === "name") return mul * a.name.localeCompare(b.name);
      if (sortCol === "domain") return mul * a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name);
      return mul * ((a[sortCol] ?? 0) - (b[sortCol] ?? 0));
    });
  }, [skills, domainFilter, search, sortCol, sortDir]);

  const SortHead = ({ col, children }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children} {sortCol === col && <span>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Skills</h1>
          <p>The skills your team cares about.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={() => setGenerating(true)}>Generate with AI</button>
          <button className="btn" onClick={() => setAdding(true)}>Add skill</button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, background: "var(--paper-warm)" }}>
          <h3 style={{ textTransform: "none", fontSize: 14 }}>No skills yet</h3>
          <h2 className="serif" style={{ fontSize: 32, margin: "8px 0 16px" }}>Describe your stack and let AI fill it in.</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>Or add skills manually — whichever you prefer.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn" onClick={() => setGenerating(true)}>Generate with AI</button>
            <button className="btn ghost" onClick={() => setAdding(true)}>Add manually</button>
          </div>
        </div>
      ) : (
        <>
          <div className="skills-toolbar">
            <input className="input skills-search" type="text" placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="gaps-view-toggle">
              <button className={`gaps-view-btn ${domainFilter === "all" ? "active" : ""}`} onClick={() => setDomainFilter("all")}>All ({skills.length})</button>
              {domains.map((d) => (
                <button key={d} className={`gaps-view-btn ${domainFilter === d ? "active" : ""}`} onClick={() => setDomainFilter(d)}>{d}</button>
              ))}
            </div>
          </div>

          <div className="gaps-table-wrap">
            <table className="gaps-table">
              <thead>
                <tr>
                  <SortHead col="name">Name</SortHead>
                  <SortHead col="domain">Domain</SortHead>
                  <th>Description</th>
                  <SortHead col="people_count">People</SortHead>
                  <SortHead col="proficient_count">Proficient</SortHead>
                  <SortHead col="avg_level">Avg level</SortHead>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SkillRow
                    key={s.id}
                    skill={s}
                    isAdmin={isAdmin}
                    userId={user.id}
                    matrixData={matrixData}
                    expanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onEdit={() => setEditing(s)}
                    onDelete={() => remove(s.id)}
                    onProficiencyChanged={reload}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--ink-mute)" }}>No skills match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a skill" lede="Group it under a domain so it shows up nicely in the matrix.">
        <AddSkillForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit skill" lede="Update the skill's name, domain, or description.">
        {editing && <EditSkillForm skill={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>

      {generating && (
        <GenerateModal onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); reload(); }} />
      )}
    </>
  );
}

function SkillRow({ skill: s, isAdmin, userId, matrixData, expanded, onToggle, onEdit, onDelete, onProficiencyChanged }) {
  const [docs, setDocs] = useState(null);

  const handleToggle = async () => {
    if (docs !== null) { onToggle(); return; }
    onToggle();
    try { setDocs(await api.kbBySkill(s.id)); }
    catch { setDocs([]); }
  };

  const levelColor = s.avg_level >= 4 ? "var(--good)" : s.avg_level >= 2.5 ? "var(--warn)" : s.avg_level > 0 ? "var(--bad)" : "var(--ink-mute)";

  // Get per-person proficiency for this skill from matrix data
  const people = matrixData?.people || [];
  const cells = matrixData?.cells || {};

  const setLevel = async (targetUserId, level) => {
    await api.setProficiency({ user_id: targetUserId, skill_id: s.id, level });
    onProficiencyChanged();
  };

  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={handleToggle}>
        <td style={{ fontWeight: 600 }}>{s.name}</td>
        <td><span className="domain-tag">{s.domain}</span></td>
        <td style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 300 }}>
          <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {s.description || "\u2014"}
          </span>
        </td>
        <td>{s.people_count}</td>
        <td>{s.proficient_count}</td>
        <td>
          <span style={{ color: levelColor, fontWeight: 600 }}>
            {s.avg_level > 0 ? s.avg_level.toFixed(1) : "\u2014"}
          </span>
        </td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {isAdmin && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="btn ghost small" style={{ padding: "2px 8px", fontSize: 11, lineHeight: 1, color: "var(--ink-mute)" }} title="Edit skill"
              >Edit</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="btn ghost small" style={{ padding: "2px 8px", fontSize: 14, lineHeight: 1, color: "var(--ink-mute)" }} title="Delete skill"
              >&times;</button>
            </>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="skill-expand-row">
          <td colSpan={7} style={{ padding: "8px 12px 16px" }}>
            <div className="skill-expand-content">
              {/* Proficiency editing */}
              {people.length > 0 && (
                <div style={{ marginBottom: docs?.length ? 16 : 0 }}>
                  <div className="prof-header">
                    <span className="prof-header-label">Proficiency levels</span>
                    <div className="prof-scale-labels">
                      <span>1 Novice</span><span>2</span><span>3</span><span>4</span><span>5 Expert</span>
                    </div>
                  </div>
                  {people.map((p) => {
                    const currentLevel = cells[`${p.id}:${s.id}`] || 0;
                    const canEdit = isAdmin || p.id === userId;
                    return (
                      <div key={p.id} className="prof-row">
                        <span className="prof-row-name">{p.name}</span>
                        <div className="prof-bar">
                          {[1, 2, 3, 4, 5].map((lv) => (
                            <button
                              key={lv}
                              className={`prof-seg ${lv <= currentLevel ? "filled" : ""} ${lv === currentLevel ? "edge" : ""}`}
                              onClick={(e) => { e.stopPropagation(); if (canEdit) setLevel(p.id, lv); }}
                              style={{ cursor: canEdit ? "pointer" : "default", opacity: canEdit ? 1 : 0.5 }}
                              title={canEdit ? `Set to ${LEVEL_LABELS[lv]}` : LEVEL_LABELS[lv]}
                            />
                          ))}
                        </div>
                        <span className="prof-level-label">
                          {currentLevel ? LEVEL_LABELS[currentLevel] : "Not set"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* KB docs */}
              {docs === null && <span className="loader"><span /><span /><span /></span>}
              {docs && docs.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  No knowledge base docs linked. <Link to="/app/kb" style={{ color: "var(--accent)" }}>Go to Knowledge Base</Link> to link one.
                </span>
              )}
              {docs && docs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Linked documents
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {docs.map((d) => (
                      <Link key={d.id} to="/app/kb" className="skill-doc-chip">
                        {d.title}
                        <span className="skill-doc-meta">{d.author_name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AddSkillForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", domain: "tools", description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api.createSkill(form); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Skill name</label>
        <input className="input" value={form.name} onChange={change("name")} placeholder="PostgreSQL" required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Domain</label>
        <select className="input" value={form.domain} onChange={change("domain")}>
          {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">Description (optional)</label>
        <input className="input" value={form.description} onChange={change("description")} placeholder="What this skill covers" />
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving\u2026" : "Add skill"}</button>
      </div>
    </form>
  );
}

function EditSkillForm({ skill, onClose, onSaved }) {
  const [form, setForm] = useState({ name: skill.name, domain: skill.domain, description: skill.description || "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api.updateSkill(skill.id, form); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Skill name</label>
        <input className="input" value={form.name} onChange={change("name")} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Domain</label>
        <select className="input" value={form.domain} onChange={change("domain")}>
          {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={change("description")} />
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving\u2026" : "Save"}</button>
      </div>
    </form>
  );
}

function GenerateModal({ onClose, onDone }) {
  const [step, setStep] = useState("describe");
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await api.generateSkills(description);
      setSuggestions(res.skills);
      setSelected(new Set(res.skills.map((_, i) => i)));
      setStep("review");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const toggle = (i) => { const next = new Set(selected); next.has(i) ? next.delete(i) : next.add(i); setSelected(next); };
  const selectAll = () => setSelected(new Set(suggestions.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());

  const importSkills = async () => {
    setErr(""); setBusy(true);
    try { await api.bulkAddSkills(suggestions.filter((_, i) => selected.has(i))); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: step === "review" ? 700 : 520 }} onClick={(e) => e.stopPropagation()}>
        {step === "describe" && (
          <>
            <h2>Generate skills with AI</h2>
            <p className="lede">Describe your team's tech stack, tools, cloud providers, languages, and practices.</p>
            {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={"We run Node.js and React apps on AWS ECS behind Cloudflare. PostgreSQL for databases, Terraform for infrastructure, GitHub Actions for CI/CD."}
              style={{ resize: "vertical", lineHeight: 1.6 }} />
            <div className="actions">
              <button className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn small accent" onClick={generate} disabled={busy || description.trim().length < 10}>{busy ? "Generating\u2026" : "Generate"}</button>
            </div>
          </>
        )}
        {step === "review" && (
          <>
            <h2>Review generated skills</h2>
            <p className="lede">{suggestions.length} skills suggested. Uncheck any you don't want.</p>
            {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, fontSize: 12 }}>
              <button className="btn ghost small" onClick={selectAll} style={{ padding: "4px 12px" }}>Select all</button>
              <button className="btn ghost small" onClick={selectNone} style={{ padding: "4px 12px" }}>Deselect all</button>
              <span style={{ marginLeft: "auto", color: "var(--ink-mute)", alignSelf: "center" }}>{selected.size} of {suggestions.length} selected</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((s, i) => (
                <label key={i} style={{ display: "flex", gap: 14, alignItems: "start", padding: "14px 16px", borderRadius: 12,
                  background: selected.has(i) ? "var(--paper-card)" : "transparent",
                  border: `1px solid ${selected.has(i) ? "var(--line-strong)" : "var(--line)"}`, cursor: "pointer" }}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      <span className="pill" style={{ fontSize: 10 }}>{s.domain}</span>
                    </div>
                    {s.description && <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.5 }}>{s.description}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn ghost small" onClick={() => setStep("describe")} disabled={busy}>Back</button>
              <button className="btn small" onClick={importSkills} disabled={busy || selected.size === 0}>{busy ? "Importing\u2026" : `Import ${selected.size} skills`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
