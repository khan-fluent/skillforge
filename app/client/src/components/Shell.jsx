import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const NAV = [
  { to: "/app", label: "Overview", icon: "◇" },
  {
    label: "Knowledge", icon: "✦", children: [
      { to: "/app/skills", label: "Skills" },
      { to: "/app/domains", label: "Domains" },
      { to: "/app/matrix", label: "Matrix" },
      { to: "/app/gaps", label: "Gaps" },
    ],
  },
  {
    label: "People", icon: "○", children: [
      { to: "/app/people", label: "Members" },
      { to: "/app/certifications", label: "Certifications" },
    ],
  },
  { to: "/app/kb", label: "Knowledge base", icon: "☰" },
  { to: "/app/chat", label: "AI assistant", icon: "✧" },
  { to: "/app/settings", label: "Settings", icon: "⚙" },
];

export default function Shell() {
  const { user, team, logout } = useAuth();
  const location = useLocation();
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("");

  // Auto-expand the section containing the current route
  const activeSection = NAV.find(
    (n) => n.children?.some((c) => location.pathname.startsWith(c.to))
  )?.label;

  const [expanded, setExpanded] = useState(activeSection ? new Set([activeSection]) : new Set(["Knowledge"]));

  const toggle = (label) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="brand">Skillforge<span className="dot">.</span></div>
        <div className="team-name">{team?.name}</div>
        <nav>
          {NAV.map((n) =>
            n.children ? (
              <NavSection
                key={n.label}
                section={n}
                isOpen={expanded.has(n.label)}
                onToggle={() => toggle(n.label)}
                pathname={location.pathname}
              />
            ) : (
              <NavLink key={n.to} to={n.to} end={n.to === "/app"}>
                <span className="icon">{n.icon}</span>
                {n.label}
              </NavLink>
            )
          )}
        </nav>
        <ThemeToggle style={{ marginBottom: 14, alignSelf: "flex-start" }} />
        <div className="me">
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div className="role">{user.role}</div>
            <button onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="shell-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavSection({ section, isOpen, onToggle, pathname }) {
  const hasActive = section.children.some((c) => pathname.startsWith(c.to));

  return (
    <div className={`nav-section ${hasActive ? "has-active" : ""}`}>
      <button className="nav-section-toggle" onClick={onToggle}>
        <span className="icon">{section.icon}</span>
        {section.label}
        <span className={`nav-chevron ${isOpen ? "open" : ""}`}>&#9656;</span>
      </button>
      {isOpen && (
        <div className="nav-section-children">
          {section.children.map((c) => (
            <NavLink key={c.to} to={c.to}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
