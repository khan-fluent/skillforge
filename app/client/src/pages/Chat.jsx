import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.js";

const SUGGESTIONS = [
  "Who should staff a project that needs Kubernetes, PostgreSQL, and AWS?",
  "What are our biggest knowledge gaps right now?",
  "Build a learning path for my junior frontend engineer.",
  "Which certifications expire soonest and who should renew first?",
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await api.chat(next);
      setMessages([...next, reply]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>AI assistant</h1>
          <p>Ask anything about your team's skills, gaps, staffing, or learning paths.</p>
        </div>
      </div>

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
              {m.role === "assistant"
                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                : m.content}
            </div>
          ))}
          {loading && <div className="msg assistant"><span className="loader"><span /><span /><span /></span></div>}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your team's skills, gaps, or staffing…" disabled={loading} />
          <button type="submit" className="btn" disabled={loading || !input.trim()}>Send</button>
        </form>
      </div>
    </>
  );
}
