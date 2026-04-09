import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const DOMAINS = ["databases", "cloud", "languages", "tools", "other"];

export default function Skills() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [adding, setAdding] = useState(false);

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
        <button className="btn" onClick={() => setAdding(true)}>Add skill</button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48, background: "var(--paper-warm)" }}>
          <h3 style={{ textTransform: "none", fontSize: 14 }}>No skills yet</h3>
          <h2 className="serif" style={{ fontSize: 32, margin: "8px 0 16px" }}>Add the first skill.</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>What does your team need to know how to do?</p>
          <button className="btn" onClick={() => setAdding(true)}>Add a skill</button>
        </div>
      )}

      {Object.entries(grouped).map(([domain, items]) => (
        <div key={domain} style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 14 }}>{domain}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {items.map((s) => (
              <div key={s.id} className="card" style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</div>
                    {s.description && <div style={{ color: "var(--ink-mute)", fontSize: 12, marginTop: 4 }}>{s.description}</div>}
                  </div>
                  {user.role === "admin" && (
                    <button onClick={() => remove(s.id)} style={{ color: "var(--ink-mute)", fontSize: 16 }} title="Delete">×</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <span>{s.people_count} people</span>
                  <span>{s.proficient_count} proficient</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a skill" lede="Group it under a domain so it shows up nicely in the matrix.">
        <AddSkillForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
      </Modal>
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
      {err && <div className="error" style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
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
