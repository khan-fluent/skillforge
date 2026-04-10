import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

export default function People() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const reload = () => api.members().then(setPeople).catch(() => {});
  useEffect(() => { reload(); }, []);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>People</h1>
          <p>Everyone on your team and the shape of what they know.</p>
        </div>
        {user.role === "admin" && <button className="btn" onClick={() => setAdding(true)}>Add member</button>}
      </div>

      <div className="people-grid">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} onChanged={reload} onEdit={() => setEditing(p)} onInvited={(link) => setInviteResult({ name: p.name, link })} />
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit member" lede="Update name, job title, or role.">
        {editing && <EditMemberForm person={editing} isAdmin={user.role === "admin"} isMe={editing.id === user.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a teammate" lede="They'll get an invite link to set their password and join.">
        <AddForm onClose={() => setAdding(false)} onCreated={(member) => {
          setAdding(false);
          reload();
          setInviteResult({ name: member.name, link: `${window.location.origin}/accept/${member.invite_token}` });
        }} />
      </Modal>

      <Modal open={!!inviteResult} onClose={() => setInviteResult(null)} title="Invite ready" lede={`Send this link to ${inviteResult?.name}. It lets them set a password and join your team.`}>
        {inviteResult && (
          <>
            <div className="invite-link">
              <input value={inviteResult.link} readOnly onFocus={(e) => e.target.select()} />
              <button onClick={() => navigator.clipboard.writeText(inviteResult.link)}>Copy</button>
            </div>
            <div className="actions">
              <button className="btn small" onClick={() => setInviteResult(null)}>Done</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function PersonCard({ person, onChanged, onEdit, onInvited }) {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const isMe = user.id === person.id;
  const pending = !person.accepted_at;

  const remove = async () => {
    if (!confirm(`Remove ${person.name} from the team?`)) return;
    await api.deleteMember(person.id);
    onChanged();
  };
  const reinvite = async () => {
    const result = await api.reinviteMember(person.id);
    onInvited(`${window.location.origin}/accept/${result.invite_token}`);
  };

  return (
    <div className="person-card">
      <div className="avatar-lg">{person.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</div>
      <div className="name">{person.name}{isMe && <span className="pill" style={{ marginLeft: 8 }}>you</span>}</div>
      <div className="title">{person.job_title || "—"}</div>
      <div className="meta">
        <span className={`pill ${person.role === "admin" ? "accent" : ""}`}>{person.role}</span>
        {pending && <span className="pill warn">invite pending</span>}
      </div>
      <div className="stats">
        <div>Skills<strong>{person.skill_count}</strong></div>
        <div>Avg level<strong>{person.avg_level.toFixed(1)}</strong></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {(isAdmin || isMe) && <button className="btn ghost small" onClick={onEdit}>Edit</button>}
        {isAdmin && !isMe && pending && <button className="btn ghost small" onClick={reinvite}>Resend invite</button>}
        {isAdmin && !isMe && <button className="btn ghost small" onClick={remove} style={{ color: "var(--bad)", borderColor: "rgba(184,72,46,0.3)" }}>Remove</button>}
      </div>
    </div>
  );
}

function EditMemberForm({ person, isAdmin, isMe, onClose, onSaved }) {
  const [form, setForm] = useState({ name: person.name, job_title: person.job_title || "", role: person.role });
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.updateMember(person.id, form); onSaved(); }
    catch { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={change("name")} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Job title</label>
        <input className="input" value={form.job_title} onChange={change("job_title")} placeholder="Senior Backend Engineer" />
      </div>
      {isAdmin && (
        <div className="field">
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={change("role")}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Saving\u2026" : "Save"}</button>
      </div>
    </form>
  );
}

function AddForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", role: "member", job_title: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { onCreated(await api.createMember(form)); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      {err && <div className="error" style={{ background: "#f5dcd2", color: "var(--bad)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{err}</div>}
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={change("name")} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email} onChange={change("email")} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Job title (optional)</label>
        <input className="input" value={form.job_title} onChange={change("job_title")} placeholder="Senior Backend Engineer" />
      </div>
      <div className="field">
        <label className="label">Role</label>
        <select className="input" value={form.role} onChange={change("role")}>
          <option value="member">Member — manages their own profile</option>
          <option value="admin">Admin — full access</option>
        </select>
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Creating…" : "Create & invite"}</button>
      </div>
    </form>
  );
}
