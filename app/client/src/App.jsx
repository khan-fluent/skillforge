import { Routes, Route, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

import Dashboard from "./sections/Dashboard.jsx";
import Matrix from "./sections/Matrix.jsx";
import People from "./sections/People.jsx";
import Gaps from "./sections/Gaps.jsx";
import Certifications from "./sections/Certifications.jsx";
import Chat from "./sections/Chat.jsx";

const nav = [
  { to: "/",              label: "Dashboard",      icon: "◆" },
  { to: "/matrix",        label: "Skill Matrix",   icon: "▦" },
  { to: "/people",        label: "People",         icon: "◉" },
  { to: "/gaps",          label: "Knowledge Gaps", icon: "△" },
  { to: "/certifications",label: "Certifications", icon: "✦" },
  { to: "/chat",          label: "AI Assistant",   icon: "✧" },
];

export default function App() {
  const location = useLocation();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Skillforge</div>
        <div className="tagline">Knowledge Intelligence</div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/matrix" element={<Matrix />} />
              <Route path="/people" element={<People />} />
              <Route path="/gaps" element={<Gaps />} />
              <Route path="/certifications" element={<Certifications />} />
              <Route path="/chat" element={<Chat />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
