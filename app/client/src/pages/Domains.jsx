import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const CATEGORIES = [
  { value: "product", label: "Products" },
  { value: "business_unit", label: "Business units" },
  { value: "system", label: "Internal systems" },
  { value: "process", label: "Processes" },
  { value: "general", label: "General" },
];

export default function Domains() {
  const { user } = useAuth();
  const [domains, setDomains] = useState([]);
  const [gaps, setGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview"); // overview | gaps
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "product", description: "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const isAdmin = user?.role === "admin";

  const load = () => {
    Promise.all([api.domains(), api.domainGaps()])
      .then(([d, g]) => { setDomains(d); setGaps(g); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addDomain = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createDomain(form);
      setForm({ name: "", category: "product", description: "" });
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  };

  const deleteDomain = async (id) => {
    await api.deleteDomain(id);
    load();
  };

  const setLevel = async (domainId, level) => {
    await api.setDomainProf({ domain_id: domainId, level });
    load();
  };

  if (loading) return <div style={{ padding: 48 }}><span className="loader"><span /><span /><span /></span></div>;

  const gapDomains = gaps?.domains || [];
  const summary = gaps?.summary || { critical: 0, high_risk: 0, healthy: 0, total: 0 };

  // Group domains by category
  const grouped = {};
  const source = view === "gaps" ? gapDomains : domains;
  for (const d of source) {
    const cat = d.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(d);
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Domains</h1>
          <p>Business units, products, and internal systems your team has expertise in.</p>
        </div>
        {isAdmin && (
          <button className="btn accent" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancel" : "+ Add domain"}
          </button>
        )}
      </div>

      {/* View toggle + summary strip */}
      <div className="domains-topbar">
        <div className="gaps-view-toggle">
          <button className={`gaps-view-btn ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>
            Overview
          </button>
          <button className={`gaps-view-btn ${view === "gaps" ? "active" : ""}`} onClick={() => setView("gaps")}>
            Gap analysis
          </button>
        </div>

        {view === "gaps" && summary.total > 0 && (
          <div className="domains-summary">
            <span className="pill bad" style={{ fontSize: 11 }}>{summary.critical} critical</span>
            <span className="pill warn" style={{ fontSize: 11 }}>{summary.high_risk} at risk</span>
            <span className="pill good" style={{ fontSize: 11 }}>{summary.healthy} healthy</span>
          </div>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <form className="card domains-add-form" onSubmit={addDomain}>
          <div className="domains-add-row">
            <input
              className="input"
              placeholder="Domain name (e.g. Payments Platform)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button className="btn accent" disabled={saving}>{saving ? "Adding..." : "Add"}</button>
          </div>
          <input
            className="input"
            placeholder="Brief description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ marginTop: 8 }}
          />
        </form>
      )}

      {/* Domain list grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
          No domains yet. Add your products, business units, or internal systems to start mapping expertise.
        </div>
      ) : (
        Object.entries(grouped)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([cat, items]) => (
            <div key={cat} className="domains-group">
              <div className="domains-group-label">
                {CATEGORIES.find((c) => c.value === cat)?.label || cat}
              </div>
              <div className="domains-list">
                {items.map((d) => (
                  <DomainRow
                    key={d.id}
                    domain={d}
                    view={view}
                    isAdmin={isAdmin}
                    userId={user.id}
                    onSetLevel={setLevel}
                    onEdit={() => setEditing(d)}
                    onDelete={deleteDomain}
                  />
                ))}
              </div>
            </div>
          ))
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit domain">
        {editing && <EditDomainForm domain={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      </Modal>
    </>
  );
}

function EditDomainForm({ domain, onClose, onSaved }) {
  const [form, setForm] = useState({ name: domain.name, category: domain.category || "general", description: domain.description || "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.updateDomain(domain.id, form); onSaved(); }
    catch { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Category</label>
        <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving\u2026" : "Save"}</button>
      </div>
    </form>
  );
}

function DomainRow({ domain: d, view, isAdmin, userId, onSetLevel, onEdit, onDelete }) {
  const isGap = view === "gaps";
  const riskColor = d.bus_factor === 0 ? "var(--bad)" : d.bus_factor === 1 ? "var(--warn)" : "var(--good)";

  return (
    <div className="domain-row-item">
      <div className="domain-row-info">
        <div className="domain-row-name">{d.name}</div>
        {d.description && <div className="domain-row-desc">{d.description}</div>}
      </div>

      {isGap ? (
        <div className="domain-row-gap">
          <div className="domain-row-bf" style={{ color: riskColor }}>
            <span className="serif">{d.bus_factor}</span>
            <span className="domain-row-bf-label">bus factor</span>
          </div>
          <div className="domain-row-bar-wrap">
            <div className="domain-row-bar">
              <div style={{
                width: `${d.total_known > 0 ? (d.bus_factor / d.total_known) * 100 : 0}%`,
                background: riskColor,
                minWidth: d.bus_factor > 0 ? 4 : 0,
              }} />
            </div>
            <div className="domain-row-bar-labels">
              <span>{d.bus_factor} proficient</span>
              <span>{d.total_known} know it</span>
            </div>
          </div>
          <span className={`pill ${d.bus_factor === 0 ? "bad" : d.bus_factor === 1 ? "warn" : "good"}`} style={{ fontSize: 10, whiteSpace: "nowrap" }}>
            {d.bus_factor === 0 ? "Critical" : d.bus_factor === 1 ? "At risk" : "Healthy"}
          </span>
        </div>
      ) : (
        <div className="domain-row-stats">
          <div className="domain-row-stat">
            <span className="domain-row-stat-value">{d.people_count}</span>
            <span className="domain-row-stat-label">people</span>
          </div>
          <div className="domain-row-stat">
            <span className="domain-row-stat-value">{d.avg_level > 0 ? d.avg_level.toFixed(1) : "\u2014"}</span>
            <span className="domain-row-stat-label">avg level</span>
          </div>
          <div className="domain-row-rating">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                className={`rating-dot ${lvl <= (d.proficient_count > 0 ? 4 : 0) ? "filled" : ""}`}
                onClick={() => onSetLevel(d.id, lvl)}
                title={`Rate yourself: ${lvl}/5`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {isAdmin && !isGap && (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn ghost small" onClick={onEdit}
            style={{ padding: "4px 8px", fontSize: 11, color: "var(--ink-mute)" }}>Edit</button>
          <button className="btn ghost small" onClick={() => onDelete(d.id)}
            style={{ padding: "4px 10px", fontSize: 14, lineHeight: 1, color: "var(--ink-mute)" }}>&times;</button>
        </div>
      )}
    </div>
  );
}
