import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.js";
import Modal from "../components/Modal.jsx";

const SUGGESTIONS = [
  "Who should staff a project that needs Kubernetes, PostgreSQL, and AWS?",
  "What are our biggest knowledge gaps right now?",
  "Build a learning path for my junior frontend engineer.",
  "Which certifications expire soonest and who should renew first?",
];

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveModal, setSaveModal] = useState(null); // { content } or null
  const scrollRef = useRef(null);

  // Load sessions
  const loadSessions = useCallback(() => {
    api.chatSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Handle context param from insight CTA
  useEffect(() => {
    const context = params.get("context");
    if (context) {
      setParams({}, { replace: true });
      startNewSession(context);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const startNewSession = async (initialMessage) => {
    const title = initialMessage.length > 60 ? initialMessage.slice(0, 57) + "..." : initialMessage;
    const session = await api.createSession(title);
    setActiveSessionId(session.id);
    setMessages([]);
    loadSessions();
    // Send the initial message
    sendInSession(session.id, initialMessage);
  };

  const loadSession = async (id) => {
    const session = await api.getSession(id);
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
  };

  const newChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const deleteSession = async (id) => {
    await api.deleteSession(id);
    if (activeSessionId === id) newChat();
    loadSessions();
  };

  async function sendInSession(sessionId, text) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await api.chat(next, sessionId);
      setMessages([...next, { role: "assistant", content: reply.content }]);
      loadSessions(); // Refresh timestamps
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    // Create a session if we don't have one
    if (!activeSessionId) {
      await startNewSession(content);
      return;
    }

    sendInSession(activeSessionId, content);
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>AI assistant</h1>
          <p>Ask anything about your team's skills, gaps, staffing, or learning paths.</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* Session sidebar */}
        <div className="chat-sidebar">
          <button className="btn small" onClick={newChat} style={{ width: "100%", marginBottom: 12 }}>
            + New chat
          </button>
          <div className="chat-session-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`chat-session-item ${activeSessionId === s.id ? "active" : ""}`}
                onClick={() => loadSession(s.id)}
              >
                <div className="chat-session-title">{s.title}</div>
                <div className="chat-session-meta">
                  {s.message_count} msg{s.message_count !== 1 ? "s" : ""} · {new Date(s.updated_at).toLocaleDateString()}
                </div>
                <button
                  className="chat-session-delete"
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  title="Delete"
                >&times;</button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: "16px 4px", textAlign: "center" }}>
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-shell">
          <div className="chat-msgs" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="empty-chat">
                <h2>Skillforge AI</h2>
                <p>Grounded in your team's live data. Powered by Claude.</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "assistant" ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    <button
                      className="chat-save-btn"
                      onClick={() => setSaveModal({ content: m.content })}
                      title="Save to Knowledge Base"
                    >
                      Save to KB
                    </button>
                  </>
                ) : m.content}
              </div>
            ))}
            {loading && (
              <div className="msg assistant chat-thinking">
                <div className="chat-thinking-content">
                  <span className="loader"><span /><span /><span /></span>
                  <span>Analyzing your team data and generating response...</span>
                </div>
              </div>
            )}
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={loading ? "Thinking..." : "Ask about your team's skills, gaps, or staffing..."} disabled={loading} />
            <button type="submit" className="btn" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>
      </div>

      {/* Save to KB modal */}
      <Modal open={!!saveModal} onClose={() => setSaveModal(null)} title="Save to Knowledge Base" lede="Save this AI response as a document.">
        {saveModal && <SaveToKBForm content={saveModal.content} onClose={() => setSaveModal(null)} />}
      </Modal>
    </>
  );
}

function SaveToKBForm({ content, onClose }) {
  const [folders, setFolders] = useState([]);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.kbFolders().then((f) => {
      setFolders(f);
      if (f.length > 0) setFolderId(String(f[0].id));
    }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!folderId || !title.trim()) return;
    setBusy(true);
    try {
      await api.createKbDoc({ title: title.trim(), folder_id: folderId, content });
      setDone(true);
    } catch { setBusy(false); }
  };

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 16 }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Saved!</div>
        <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>Document created in your Knowledge Base.</p>
        <button className="btn small" onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Document title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Upskilling plan for..." required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Folder</label>
        {folders.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>No folders yet. Create one in the Knowledge Base first.</div>
        ) : (
          <select className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)} required>
            <option value="" disabled>Select a folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 14, maxHeight: 100, overflow: "hidden", lineHeight: 1.5 }}>
        {content.slice(0, 300)}{content.length > 300 ? "..." : ""}
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy || !folderId || !title.trim()}>
          {busy ? "Saving..." : "Save document"}
        </button>
      </div>
    </form>
  );
}
