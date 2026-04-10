import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const DOMAINS = ["databases", "cloud", "languages", "tools", "practices", "security", "data", "other"];

export default function Skills() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reload = () => api.skills().then(setSkills).catch(() => {});
  useEffect(() => { reload(); }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const s of skills) (g[s.domain] = g[s.domain] || []).push(s);
    return g;
  }, [skills]);

  const remove = async (id) => {
    if (!confirm("Delete this skill? Proficiencies for it will also be removed.")) return;
    await api.deleteSkill(id);
    reload();
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Skills</h1>
          <p>The skills your team cares about, organized by domain.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={() => setGenerating(true)}>✧ Generate with AI</button>
          <button className="btn" onClick={() => setAdding(true)}>Add skill</button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48, background: "var(--paper-warm)" }}>
          <h3 style={{ textTransform: "none", fontSize: 14 }}>No skills yet</h3>
          <h2 className="serif" style={{ fontSize: 32, margin: "8px 0 16px" }}>Describe your stack and let AI fill it in.</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>Or add skills manually — whichever you prefer.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn" onClick={() => setGenerating(true)}>✧ Generate with AI</button>
            <button className="btn ghost" onClick={() => setAdding(true)}>Add manually</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([domain, items]) => (
        <div key={domain} style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 14 }}>{domain}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {items.map((s) => (
              <SkillCard key={s.id} skill={s} isAdmin={user.role === "admin"} onDelete={() => remove(s.id)} />
            ))}
          </div>
        </div>
      ))}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a skill" lede="Group it under a domain so it shows up nicely in the matrix.">
        <AddSkillForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
      </Modal>

      {generating && (
        <GenerateModal onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); reload(); }} />
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
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving…" : "Add skill"}</button>
      </div>
    </form>
  );
}

function SkillCard({ skill: s, isAdmin, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [docs, setDocs] = useState(null);

  const loadDocs = async () => {
    if (docs !== null) { setExpanded(!expanded); return; }
    setExpanded(true);
    try { setDocs(await api.kbBySkill(s.id)); }
    catch { setDocs([]); }
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</div>
          {s.description && <div style={{ color: "var(--ink-mute)", fontSize: 12, marginTop: 4 }}>{s.description}</div>}
        </div>
        {isAdmin && (
          <button onClick={onDelete} style={{ color: "var(--ink-mute)", fontSize: 16 }} title="Delete">×</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <span>{s.people_count} people</span>
        <span>{s.proficient_count} proficient</span>
      </div>
      <button
        onClick={loadDocs}
        style={{ marginTop: 14, fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}
      >
        <span>{expanded ? "▾" : "▸"}</span> Knowledge base docs
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {docs === null && <span className="loader"><span /><span /><span /></span>}
          {docs && docs.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              No docs linked to this skill yet. <Link to="/app/kb" style={{ color: "var(--accent)" }}>Go to Knowledge Base</Link> to link one.
            </div>
          )}
          {docs && docs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docs.map((d) => (
                <Link
                  key={d.id}
                  to="/app/kb"
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: "var(--paper-warm)", border: "1px solid var(--line)",
                    fontSize: 13, transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-soft)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--paper-warm)"}
                >
                  <span style={{ fontWeight: 500 }}>{d.title}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                    {d.author_name} · {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GenerateModal({ onClose, onDone }) {
  const [step, setStep] = useState("describe"); // describe → review → importing
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

  const toggle = (i) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(suggestions.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());

  const importSkills = async () => {
    setErr(""); setBusy(true);
    try {
      const toAdd = suggestions.filter((_, i) => selected.has(i));
      await api.bulkAddSkills(toAdd);
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: step === "review" ? 700 : 520 }} onClick={(e) => e.stopPropagation()}>
        {step === "describe" && (
          <>
            <h2>Generate skills with AI</h2>
            <p className="lede">Describe your team's tech stack, tools, cloud providers, languages, and practices. Skillforge will generate structured skills with the right domains.</p>
            {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <textarea
              className="input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"We run Node.js and React apps on AWS ECS behind Cloudflare. PostgreSQL for databases, Terraform for infrastructure, GitHub Actions for CI/CD. Some Python for data pipelines. Starting to explore Kubernetes."}
              style={{ resize: "vertical", lineHeight: 1.6 }}
            />
            <div className="actions">
              <button className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn small accent" onClick={generate} disabled={busy || description.trim().length < 10}>
                {busy ? "Generating…" : "✧ Generate"}
              </button>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <h2>Review generated skills</h2>
            <p className="lede">
              {suggestions.length} skills suggested. Uncheck any you don't want, then import.
            </p>
            {err && <div style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}

            <div style={{ display: "flex", gap: 10, marginBottom: 16, fontSize: 12 }}>
              <button className="btn ghost small" onClick={selectAll} style={{ padding: "4px 12px" }}>Select all</button>
              <button className="btn ghost small" onClick={selectNone} style={{ padding: "4px 12px" }}>Deselect all</button>
              <span style={{ marginLeft: "auto", color: "var(--ink-mute)", alignSelf: "center" }}>
                {selected.size} of {suggestions.length} selected
              </span>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((s, i) => (
                <label
                  key={i}
                  style={{
                    display: "flex", gap: 14, alignItems: "start",
                    padding: "14px 16px", borderRadius: 12,
                    background: selected.has(i) ? "var(--paper-card)" : "transparent",
                    border: `1px solid ${selected.has(i) ? "var(--line-strong)" : "var(--line)"}`,
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    style={{ marginTop: 3, accentColor: "var(--accent)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      <span className="pill" style={{ fontSize: 10 }}>{s.domain}</span>
                    </div>
                    {s.description && (
                      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.5 }}>{s.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn ghost small" onClick={() => setStep("describe")} disabled={busy}>Back</button>
              <button className="btn small" onClick={importSkills} disabled={busy || selected.size === 0}>
                {busy ? "Importing…" : `Import ${selected.size} skills`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
