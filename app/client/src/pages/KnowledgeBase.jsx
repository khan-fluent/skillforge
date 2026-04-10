import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Modal from "../components/Modal.jsx";

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null); // null = all, or folder id
  const [activeDoc, setActiveDoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);

  const reloadFolders = useCallback(() => api.kbFolders().then(setFolders).catch(() => {}), []);
  const reloadDocs = useCallback(() => api.kbDocuments(activeFolder).then(setDocs).catch(() => {}), [activeFolder]);
  const reloadStats = useCallback(() => api.kbStats().then(setStats).catch(() => {}), []);

  useEffect(() => { reloadFolders(); api.skills().then(setSkills).catch(() => {}); reloadStats(); }, []);
  useEffect(() => { reloadDocs(); setActiveDoc(null); }, [activeFolder]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(() => api.kbSearch(search).then(setSearchResults).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openDoc = async (id) => {
    const doc = await api.kbDocument(id);
    setActiveDoc(doc);
    setEditing(false);
  };

  const deleteDoc = async (id) => {
    if (!confirm("Delete this document?")) return;
    await api.deleteKbDoc(id);
    setActiveDoc(null);
    reloadDocs(); reloadStats();
  };

  const isAdmin = user.role === "admin";
  const folderName = (id) => folders.find((f) => f.id === id)?.name || "";
  const storagePercent = stats ? Math.round((stats.storage_used / stats.storage_limit) * 100) : 0;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge base</h1>
          <p>Your team's internal documentation, guides, and reference material — all in one searchable place.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={() => setShowNewFolder(true)}>New folder</button>
          <button className="btn" onClick={() => {
            if (folders.length === 0) { setShowNewFolder(true); return; }
            setShowNewDoc(true);
          }}>New document</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 22, minHeight: 500 }}>
        {/* Sidebar */}
        <div>
          {/* Search */}
          <input
            className="input"
            placeholder="Search docs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 16, fontSize: 13 }}
          />

          {/* Folder tree */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FolderItem
              name="All documents" count={null}
              active={activeFolder === null}
              onClick={() => setActiveFolder(null)}
            />
            {buildTree(folders, null).map((f) => (
              <FolderTreeItem
                key={f.id} folder={f} folders={folders}
                activeFolder={activeFolder}
                onSelect={(id) => setActiveFolder(id)}
                onDelete={isAdmin ? async (id) => {
                  if (!confirm("Delete this folder and all documents inside it?")) return;
                  await api.deleteKbFolder(id);
                  if (activeFolder === id) setActiveFolder(null);
                  reloadFolders();
                } : null}
              />
            ))}
          </div>

          {/* Storage gauge */}
          {stats && (
            <div style={{ marginTop: 24, padding: 16, background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: 14 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Storage</div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${storagePercent}%`, background: storagePercent > 80 ? "var(--warn)" : "var(--ink)", borderRadius: 999 }} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                {(stats.storage_used / 1000).toFixed(0)} KB / {(stats.storage_limit / 1_000_000).toFixed(0)} MB
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8 }}>
                {stats.documents} doc{stats.documents !== 1 ? "s" : ""} · {stats.folders} folder{stats.folders !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>

        {/* Main area */}
        <div>
          {/* Search results overlay */}
          {searchResults !== null && (
            <div className="card" style={{ marginBottom: 18 }}>
              <h3>Search results for "{search}"</h3>
              {searchResults.length === 0 && <div style={{ color: "var(--ink-mute)", fontSize: 13, marginTop: 10 }}>No documents found.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {searchResults.map((d) => (
                  <button key={d.id} onClick={() => { openDoc(d.id); setSearch(""); setSearchResults(null); }}
                    style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, background: "var(--paper-warm)", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{d.title}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{d.author_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Document view */}
          {activeDoc ? (
            <DocView
              doc={activeDoc}
              skills={skills}
              editing={editing}
              isAdmin={isAdmin}
              isOwner={activeDoc.created_by === user.id}
              onEdit={() => setEditing(true)}
              onSaved={async (updated) => { setActiveDoc(updated); setEditing(false); reloadDocs(); reloadStats(); }}
              onCancel={() => setEditing(false)}
              onDelete={() => deleteDoc(activeDoc.id)}
              onBack={() => setActiveDoc(null)}
            />
          ) : (
            <DocList docs={docs} folders={folders} onOpen={openDoc} />
          )}
        </div>
      </div>

      {/* New folder modal */}
      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="New folder">
        <NewFolderForm
          folders={folders}
          onClose={() => setShowNewFolder(false)}
          onCreated={() => { setShowNewFolder(false); reloadFolders(); }}
        />
      </Modal>

      {/* New doc modal */}
      <Modal open={showNewDoc} onClose={() => setShowNewDoc(false)} title="New document" lede="Start with a title. You can write the content after.">
        <NewDocForm
          folders={folders}
          skills={skills}
          activeFolder={activeFolder}
          onClose={() => setShowNewDoc(false)}
          onCreated={async (doc) => { setShowNewDoc(false); await reloadDocs(); reloadStats(); openDoc(doc.id); setEditing(true); }}
        />
      </Modal>
    </>
  );
}

// ─── Sub-components ───

function FolderItem({ name, active, onClick, count, indent = 0, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={onClick}
        style={{
          flex: 1, textAlign: "left",
          padding: `8px 12px 8px ${12 + indent * 16}px`,
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          color: active ? "var(--ink)" : "var(--ink-soft)",
          background: active ? "var(--paper-card)" : "transparent",
          boxShadow: active ? "var(--shadow-sm)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        {name}
        {count != null && <span className="mono" style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-mute)" }}>{count}</span>}
      </button>
      {onDelete && (
        <button onClick={onDelete} style={{ color: "var(--ink-mute)", fontSize: 14, padding: "4px 6px", opacity: 0.5 }} title="Delete">×</button>
      )}
    </div>
  );
}

function FolderTreeItem({ folder, folders, activeFolder, onSelect, onDelete, depth = 0 }) {
  const children = folders.filter((f) => f.parent_id === folder.id);
  return (
    <>
      <FolderItem
        name={folder.name}
        active={activeFolder === folder.id}
        onClick={() => onSelect(folder.id)}
        indent={depth + 1}
        onDelete={onDelete ? () => onDelete(folder.id) : null}
      />
      {children.map((c) => (
        <FolderTreeItem key={c.id} folder={c} folders={folders} activeFolder={activeFolder} onSelect={onSelect} onDelete={onDelete} depth={depth + 1} />
      ))}
    </>
  );
}

function buildTree(folders, parentId) {
  return folders.filter((f) => f.parent_id === parentId);
}

function DocList({ docs, folders, onOpen }) {
  if (!docs.length) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 56, background: "var(--paper-warm)" }}>
        <h3 style={{ textTransform: "none", fontSize: 14 }}>No documents here</h3>
        <h2 className="serif" style={{ fontSize: 28, margin: "8px 0 12px" }}>Write the first one.</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Documents support Markdown — headings, lists, code blocks, tables.</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {docs.map((d) => (
        <button
          key={d.id}
          onClick={() => onOpen(d.id)}
          className="card"
          style={{ textAlign: "left", padding: "20px 24px", cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{d.title}</div>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", marginLeft: 16 }}>
              {new Date(d.updated_at).toLocaleDateString()}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, color: "var(--ink-mute)" }}>
            {d.author_name && <span>by {d.author_name}</span>}
            <span>{Math.round((d.content_length || 0) / 1000)} KB</span>
            {d.skill_ids?.length > 0 && <span>{d.skill_ids.length} skill{d.skill_ids.length > 1 ? "s" : ""} linked</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function DocView({ doc, skills, editing, isAdmin, isOwner, onEdit, onSaved, onCancel, onDelete, onBack }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [selectedSkills, setSelectedSkills] = useState(new Set(doc.skill_ids || []));
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTitle(doc.title); setContent(doc.content); setSelectedSkills(new Set(doc.skill_ids || [])); }, [doc.id]);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.updateKbDoc(doc.id, { title, content, skill_ids: [...selectedSkills] });
      // Refetch to get joined data.
      const full = await api.kbDocument(doc.id);
      onSaved(full);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  const toggleSkill = (id) => {
    const next = new Set(selectedSkills);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSkills(next);
  };

  const canEdit = isAdmin || isOwner;
  const linkedSkills = skills.filter((s) => (doc.skill_ids || []).includes(s.id));

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to list
      </button>

      <div className="card" style={{ padding: 0 }}>
        {/* Header */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 24, fontFamily: '"Instrument Serif", serif', fontWeight: 400, border: "none", padding: 0, background: "transparent" }} />
            ) : (
              <h2 className="serif" style={{ fontSize: 32, margin: 0, lineHeight: 1.2 }}>{doc.title}</h2>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, color: "var(--ink-mute)" }}>
              {doc.author_name && <span>Created by {doc.author_name}</span>}
              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.editor_name && doc.updated_at !== doc.created_at && <span>· edited by {doc.editor_name}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {editing ? (
              <>
                <button className="btn ghost small" onClick={onCancel} disabled={busy}>Cancel</button>
                <button className="btn small" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </>
            ) : (
              <>
                {canEdit && <button className="btn ghost small" onClick={onEdit}>Edit</button>}
                {(isAdmin || isOwner) && <button className="btn ghost small" onClick={onDelete} style={{ color: "var(--bad)" }}>Delete</button>}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "28px 32px", minHeight: 200 }}>
          {editing ? (
            <textarea
              className="input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              style={{ resize: "vertical", lineHeight: 1.7, fontFamily: '"Geist Mono", monospace', fontSize: 13, border: "none", padding: 0, background: "transparent" }}
              placeholder="Write in Markdown — headings, lists, code blocks, tables all work."
            />
          ) : (
            <div style={{ lineHeight: 1.7, fontSize: 15 }} className="kb-content">
              {doc.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
              ) : (
                <div style={{ color: "var(--ink-mute)", fontStyle: "italic" }}>Empty document. Click Edit to start writing.</div>
              )}
            </div>
          )}
        </div>

        {/* Skill tags */}
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--line)", background: "var(--paper-warm)", borderRadius: "0 0 22px 22px" }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Linked skills
          </div>
          {editing ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSkill(s.id)}
                  className={`pill ${selectedSkills.has(s.id) ? "accent" : ""}`}
                  style={{ cursor: "pointer", fontSize: 11 }}
                >
                  {s.name}
                </button>
              ))}
              {!skills.length && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>No skills tracked yet.</span>}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {linkedSkills.length > 0
                ? linkedSkills.map((s) => <span key={s.id} className="pill accent" style={{ fontSize: 11 }}>{s.name}</span>)
                : <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>None — edit to link skills.</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewFolderForm({ folders, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.createKbFolder({ name, parent_id: parentId || null }); onCreated(); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Folder name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Runbooks" required />
      </div>
      <div className="field">
        <label className="label">Parent folder (optional)</label>
        <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Root</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Creating…" : "Create folder"}</button>
      </div>
    </form>
  );
}

function NewDocForm({ folders, skills, activeFolder, onClose, onCreated }) {
  const defaultFolder = typeof activeFolder === "number" ? String(activeFolder) : (folders.length > 0 ? String(folders[0].id) : "");
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState(defaultFolder);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!folderId) return;
    setBusy(true);
    try {
      const doc = await api.createKbDoc({ title, folder_id: folderId, content: "" });
      onCreated(doc);
    } catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Incident response runbook" required />
      </div>
      <div className="field">
        <label className="label">Folder</label>
        <select className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)} required>
          <option value="" disabled>Select a folder</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy || !folderId}>{busy ? "Creating\u2026" : "Create & edit"}</button>
      </div>
    </form>
  );
}
