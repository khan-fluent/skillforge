import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const STATUS = {
  expired:        { pill: "bad",  label: "Expired" },
  expiring_soon:  { pill: "warn", label: "Expiring soon" },
  valid:          { pill: "good", label: "Valid" },
  no_expiry:      { pill: "",     label: "No expiry" },
};

export default function Certifications() {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [members, setMembers] = useState([]);
  const [adding, setAdding] = useState(false);

  const reload = () => api.certifications().then(setCerts).catch(() => {});

  useEffect(() => {
    reload();
    if (user.role === "admin") api.members().then(setMembers).catch(() => {});
  }, [user.role]);

  const canDelete = (cert) => user.role === "admin" || cert.user_id === user.id;
  const remove = async (id) => {
    if (!confirm("Delete this certification?")) return;
    await api.deleteCert(id);
    reload();
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Certifications</h1>
          <p>Every credential the team holds, sorted by upcoming expiry.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>Add certification</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "18px 28px" }}>Person</th>
              <th>Certification</th>
              <th>Issuer</th>
              <th>Expires</th>
              <th>Status</th>
              <th style={{ paddingRight: 28, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 28px", fontWeight: 600, fontSize: 14 }}>{c.person_name}</td>
                <td style={{ fontSize: 14 }}>
                  {c.credential_url
                    ? <a href={c.credential_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{c.name}</a>
                    : c.name}
                </td>
                <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{c.issuer || "—"}</td>
                <td className="mono" style={{ color: "var(--ink-soft)", fontSize: 13 }}>{c.expires_on || "—"}</td>
                <td><span className={`pill ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span></td>
                <td style={{ paddingRight: 28, textAlign: "right" }}>
                  {canDelete(c) && (
                    <button onClick={() => remove(c.id)} title="Delete" style={{ color: "var(--ink-mute)", fontSize: 18, padding: "0 6px" }}>×</button>
                  )}
                </td>
              </tr>
            ))}
            {!certs.length && (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--ink-mute)" }}>No certifications tracked yet — add the first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add certification" lede={user.role === "admin" ? "Track a credential for yourself or anyone on the team." : "Track a credential you've earned."}>
        <AddCertForm
          isAdmin={user.role === "admin"}
          members={members}
          currentUserId={user.id}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); reload(); }}
        />
      </Modal>
    </>
  );
}

function AddCertForm({ isAdmin, members, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    user_id: currentUserId,
    name: "",
    issuer: "",
    issued_on: "",
    expires_on: "",
    credential_url: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: k === "user_id" ? parseInt(e.target.value, 10) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const payload = { ...form };
      // Strip empty optional fields so the backend gets nulls.
      for (const k of ["issuer", "issued_on", "expires_on", "credential_url"]) {
        if (!payload[k]) delete payload[k];
      }
      await api.createCert(payload);
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {err && <div className="error" style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {isAdmin && members.length > 0 && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">Who earned it?</label>
          <select className="input" value={form.user_id} onChange={change("user_id")}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? " (you)" : ""}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Certification name</label>
        <input className="input" value={form.name} onChange={change("name")} placeholder="AWS Solutions Architect — Professional" required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Issuer</label>
        <input className="input" value={form.issuer} onChange={change("issuer")} placeholder="AWS, HashiCorp, CNCF…" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Issued on</label>
          <input className="input" type="date" value={form.issued_on} onChange={change("issued_on")} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Expires on</label>
          <input className="input" type="date" value={form.expires_on} onChange={change("expires_on")} />
        </div>
      </div>
      <div className="field">
        <label className="label">Credential URL (optional)</label>
        <input className="input" type="url" value={form.credential_url} onChange={change("credential_url")} placeholder="https://…" />
      </div>

      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving…" : "Add certification"}</button>
      </div>
    </form>
  );
}
