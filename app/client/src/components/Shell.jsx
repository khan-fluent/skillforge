import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/app",                label: "Overview",       icon: "◇" },
  { to: "/app/matrix",         label: "Skill matrix",   icon: "▦" },
  { to: "/app/people",         label: "People",         icon: "○" },
  { to: "/app/skills",         label: "Skills",         icon: "✦" },
  { to: "/app/gaps",           label: "Knowledge gaps", icon: "△" },
  { to: "/app/certifications", label: "Certifications", icon: "❒" },
  { to: "/app/chat",           label: "AI assistant",   icon: "✧" },
  { to: "/app/settings",       label: "Settings",       icon: "⚙" },
];

export default function Shell() {
  const { user, team, logout } = useAuth();
  const location = useLocation();
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="brand">Skillforge<span className="dot">.</span></div>
        <div className="team-name">{team?.name}</div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/app"}>
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
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
