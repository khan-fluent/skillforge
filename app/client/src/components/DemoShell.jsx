import { createContext, useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DemoProvider, useDemo } from "../context/DemoContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Override AuthContext for demo mode
const DemoAuthCtx = createContext(null);

function DemoAuthProvider({ children }) {
  const { user, team } = useDemo();
  const value = {
    user, team, loading: false,
    login: async () => {}, signup: async () => {}, accept: async () => {},
    logout: () => { window.location.href = "/"; },
    refresh: async () => {},
  };
  return <DemoAuthCtx.Provider value={value}>{children}</DemoAuthCtx.Provider>;
}

// Monkey-patch: make useAuth() work by re-exporting from demo context
// We inject this via a wrapper that patches the import
export function useDemoAuth() {
  return useContext(DemoAuthCtx);
}

function SignupGate() {
  const { gateOpen, setGateOpen } = useDemo();
  if (!gateOpen) return null;
  return (
    <div className="modal-backdrop" onClick={() => setGateOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>You've been exploring!</h2>
        <p className="lede" style={{ marginBottom: 24 }}>
          Sign up to save your work, unlock AI features, invite teammates, and build your real team knowledge map.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
          <Link to="/signup" className="btn accent" style={{ padding: "12px 28px" }}>Sign up free</Link>
          <button className="btn ghost" onClick={() => setGateOpen(false)}>Keep exploring</button>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-mute)" }}>Sandbox mode — nothing is saved. Sign up to start fresh.</p>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      <span>Sandbox mode — explore freely, nothing is saved</span>
      <Link to="/signup" className="btn small" style={{ padding: "4px 16px", fontSize: 11 }}>Sign up to save</Link>
    </div>
  );
}

// Simplified demo pages that use in-memory data
import { useState, useMemo, useEffect } from "react";

function DemoOverview() {
  const { user, team, demoApi } = useDemo();
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [gaps, setGaps] = useState(null);
  useEffect(() => {
    Promise.all([demoApi.members(), demoApi.skills(), demoApi.gaps()])
      .then(([m, s, g]) => { setMembers(m); setSkills(s); setGaps(g); });
  }, []);

  return (
    <>
      <div className="page-hd">
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{team.name}</div>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p>This is a sandbox preview of Skillforge.</p>
        </div>
      </div>
      <div className="stat-row">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>People</div>
          <div className="serif" style={{ fontSize: 40 }}>{members.length}</div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Skills</div>
          <div className="serif" style={{ fontSize: 40 }}>{skills.length}</div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Critical gaps</div>
          <div className="serif" style={{ fontSize: 40, color: gaps?.summary.critical > 0 ? "var(--bad)" : "var(--good)" }}>{gaps?.summary.critical ?? 0}</div>
        </div>
      </div>
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <h2 className="serif" style={{ fontSize: 28, margin: "0 0 12px" }}>Explore the sidebar</h2>
        <p style={{ color: "var(--ink-soft)", maxWidth: 500, margin: "0 auto" }}>
          Try adding skills, setting proficiency levels, viewing the matrix, and checking knowledge gaps. This is a live sandbox — play around freely.
        </p>
      </div>
    </>
  );
}

function DemoSkills() {
  const { demoApi, gateOpen, setGateOpen } = useDemo();
  const [skills, setSkills] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const reload = () => { demoApi.skills().then(setSkills); demoApi.matrix().then(setMatrixData); };
  useEffect(() => { reload(); }, []);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "tools", description: "" });

  const addSkill = async (e) => {
    e.preventDefault();
    await demoApi.createSkill(form);
    setForm({ name: "", domain: "tools", description: "" });
    setAdding(false);
    reload();
  };

  const people = matrixData?.people || [];
  const cells = matrixData?.cells || {};

  return (
    <>
      <div className="page-hd">
        <div><h1>Skills</h1><p>The skills your team cares about.</p></div>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "Add skill"}</button>
      </div>
      {adding && (
        <form className="card" style={{ padding: 20, marginBottom: 20 }} onSubmit={addSkill}>
          <div style={{ display: "flex", gap: 10 }}>
            <input className="input" placeholder="Skill name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ flex: 1 }} />
            <select className="input" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} style={{ width: 140 }}>
              {["databases", "cloud", "languages", "tools", "practices", "security", "data", "other"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button className="btn" type="submit">Add</button>
          </div>
        </form>
      )}
      <div className="gaps-table-wrap">
        <table className="gaps-table">
          <thead><tr><th>Name</th><th>Domain</th><th>People</th><th>Proficient</th><th>Avg</th><th></th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <React.Fragment key={s.id}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><span className="domain-tag">{s.domain}</span></td>
                  <td>{s.people_count}</td>
                  <td>{s.proficient_count}</td>
                  <td style={{ color: s.avg_level >= 4 ? "var(--good)" : s.avg_level >= 2.5 ? "var(--warn)" : "var(--ink-mute)" }}>{s.avg_level > 0 ? s.avg_level.toFixed(1) : "\u2014"}</td>
                  <td><button className="btn ghost small" onClick={(e) => { e.stopPropagation(); demoApi.deleteSkill(s.id).then(reload); }} style={{ fontSize: 14, color: "var(--ink-mute)" }}>&times;</button></td>
                </tr>
                {expandedId === s.id && people.length > 0 && (
                  <tr className="skill-expand-row"><td colSpan={6} style={{ padding: "8px 12px 16px" }}>
                    <div className="skill-expand-content">
                      <div className="prof-header">
                        <span className="prof-header-label">Proficiency levels</span>
                      </div>
                      {people.map((p) => {
                        const level = cells[`${p.id}:${s.id}`] || 0;
                        return (
                          <div key={p.id} className="prof-row">
                            <span className="prof-row-name">{p.name}</span>
                            <div className="prof-bar">
                              {[1, 2, 3, 4, 5].map((lv) => (
                                <button key={lv} className={`prof-seg ${lv <= level ? "filled" : ""} ${lv === level ? "edge" : ""}`}
                                  onClick={(e) => { e.stopPropagation(); demoApi.setProficiency({ user_id: p.id, skill_id: s.id, level: lv }).then(reload); }} />
                              ))}
                            </div>
                            <span className="prof-level-label">{level ? ["", "Novice", "Beginner", "Competent", "Proficient", "Expert"][level] : "Not set"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DemoGaps() {
  const { demoApi } = useDemo();
  const [data, setData] = useState(null);
  useEffect(() => { demoApi.gaps().then(setData); }, []);
  if (!data) return <span className="loader"><span /><span /><span /></span>;
  const { summary, skills } = data;
  const healthPct = summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0;
  return (
    <>
      <div className="page-hd"><div><h1>Knowledge gaps</h1><p>Bus-factor analysis — how many people are <strong>proficient (level 4+)</strong> in each skill.</p></div></div>
      <div className="gaps-topbar">
        <div className="gaps-pills">
          <div className="gaps-pill critical"><span className="gaps-pill-count">{summary.critical}</span><span className="gaps-pill-label">Critical</span></div>
          <div className="gaps-pill warn"><span className="gaps-pill-count">{summary.high_risk}</span><span className="gaps-pill-label">At risk</span></div>
          <div className="gaps-pill good"><span className="gaps-pill-count">{summary.healthy}</span><span className="gaps-pill-label">Healthy</span></div>
        </div>
      </div>
      <div className="gaps-compact-list">
        {skills.map((s) => (
          <div key={s.id} className="gaps-row">
            <div className="gaps-row-indicator" style={{ background: s.bus_factor === 0 ? "var(--bad)" : s.bus_factor === 1 ? "var(--warn)" : "var(--good)" }} />
            <div className="gaps-row-info"><span className="gaps-row-name">{s.name}</span><span className="gaps-row-meta">{s.domain}</span></div>
            <div className="gaps-row-bf" style={{ color: s.bus_factor === 0 ? "var(--bad)" : s.bus_factor === 1 ? "var(--warn)" : "var(--good)" }}>{s.bus_factor}</div>
            <span className="gaps-row-owners">{s.proficient_people?.length ? s.proficient_people.join(", ") : "\u2014"}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function DemoLocked({ title }) {
  const { setGateOpen } = useDemo();
  return (
    <div>
      <div className="page-hd"><div><h1>{title}</h1></div></div>
      <div className="card" style={{ textAlign: "center", padding: 56 }}>
        <h2 className="serif" style={{ fontSize: 28, margin: "0 0 12px" }}>Sign up to unlock</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>This feature requires an account. Sign up free to access {title.toLowerCase()}, AI assistant, and more.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/signup" className="btn accent">Sign up free</Link>
          <button className="btn ghost" onClick={() => setGateOpen(false)}>Back</button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { NavLink } from "react-router-dom";

const DEMO_NAV = [
  { to: "/try", label: "Overview", icon: "◇" },
  { to: "/try/skills", label: "Skills", icon: "✦" },
  { to: "/try/gaps", label: "Gaps", icon: "△" },
  { to: "/try/matrix", label: "Matrix", icon: "▦" },
  { to: "/try/chat", label: "AI Assistant", icon: "✧" },
];

function DemoShellInner() {
  const { user } = useDemo();
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="brand">Skillforge<span className="dot">.</span></div>
        <div className="team-name">SANDBOX</div>
        <nav>
          {DEMO_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/try"}>
              <span className="icon">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle style={{ marginBottom: 14, alignSelf: "flex-start" }} />
        <div className="me">
          <div className="avatar">YO</div>
          <div style={{ flex: 1 }}>
            <div className="name">You (Demo)</div>
            <div className="role">admin</div>
            <Link to="/signup" style={{ fontSize: 11, color: "var(--accent)" }}>Sign up</Link>
          </div>
        </div>
      </aside>
      <main className="shell-main">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function DemoShell() {
  return (
    <DemoProvider>
      <DemoAuthProvider>
        <DemoBanner />
        <DemoShellInner />
        <SignupGate />
      </DemoAuthProvider>
    </DemoProvider>
  );
}

export { DemoOverview, DemoSkills, DemoGaps, DemoLocked };
