import { useState } from "react";

// Clickable stat card with an expandable detail panel.
// Pass `detail` as a render function or JSX for the expanded content.
export default function StatCard({ label, value, sub, color, detail, onClick }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!detail;
  const toggle = () => {
    if (onClick) { onClick(); return; }
    if (hasDetail) setOpen(!open);
  };

  return (
    <div
      className="card"
      style={{
        cursor: hasDetail || onClick ? "pointer" : "default",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        ...(open ? { boxShadow: "var(--shadow-md)" } : {}),
      }}
      onClick={toggle}
      onMouseEnter={(e) => { if (hasDetail || onClick) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
    >
      <h3>{label}</h3>
      <div className="stat-value" style={{ color: color || "var(--ink)" }}>{value}</div>
      <div className="stat-sub">{sub}</div>
      {hasDetail && (
        <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <span>{open ? "▾" : "▸"}</span> {open ? "Hide details" : "Click for details"}
        </div>
      )}
      {open && detail && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
          {typeof detail === "function" ? detail() : detail}
        </div>
      )}
    </div>
  );
}
