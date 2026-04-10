// Minimal horizontal bar chart — no dependencies. Renders a list of
// { label, value, color? } items as proportional bars with labels.

export default function BarChart({ data, maxValue, formatValue, height = 22, gap = 8 }) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const fmt = formatValue || ((v) => v);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, 2);
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>{d.label}</span>
              <span className="mono" style={{ color: "var(--ink-mute)", fontSize: 11 }}>{fmt(d.value)}</span>
            </div>
            <div style={{ height, borderRadius: 999, background: "var(--paper-warm)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: d.color || "var(--ink)",
                  borderRadius: 999,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
