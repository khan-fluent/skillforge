// Pure CSS/SVG donut chart. No deps. Takes segments: [{ value, color, label }]
// and renders a ring with a center label.

export default function DonutChart({ segments, size = 160, strokeWidth = 18, centerLabel, centerSub }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-mute)", fontSize: 13 }}>
        No data
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const gap = total > 1 ? 2 : 0;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${Math.max(dash - gap, 0)} ${circumference - dash + gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease" }}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center",
      }}>
        <div className="serif" style={{ fontSize: size * 0.2, lineHeight: 1, letterSpacing: "-0.02em" }}>{centerLabel}</div>
        {centerSub && <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>{centerSub}</div>}
      </div>
    </div>
  );
}
