import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Gaps() {
  const [data, setData] = useState(null);
  useEffect(() => { api.gaps().then(setData).catch(() => {}); }, []);
  if (!data) return <span className="loader"><span /><span /><span /></span>;

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Knowledge gaps</h1>
          <p>Bus-factor for every skill. A skill with zero or one expert is a continuity risk.</p>
        </div>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card">
          <h3>Critical</h3>
          <div className="stat-value" style={{ color: "var(--bad)" }}>{data.summary.critical}</div>
          <div className="stat-sub">no proficient owner</div>
        </div>
        <div className="card">
          <h3>High risk</h3>
          <div className="stat-value" style={{ color: "var(--warn)" }}>{data.summary.high_risk}</div>
          <div className="stat-sub">single point of failure</div>
        </div>
        <div className="card">
          <h3>Healthy</h3>
          <div className="stat-value" style={{ color: "var(--good)" }}>{data.summary.healthy}</div>
          <div className="stat-sub">two or more experts</div>
        </div>
      </div>

      <div className="gap-grid">
        {data.skills.map((s) => {
          const tier = s.bus_factor === 0 ? "critical" : s.bus_factor === 1 ? "high" : "";
          return (
            <div key={s.id} className={`gap-card ${tier}`}>
              <div className="domain">{s.domain}</div>
              <div className="name">{s.name}</div>
              <div className="bf" style={{ color: s.bus_factor === 0 ? "var(--bad)" : s.bus_factor === 1 ? "var(--warn)" : "var(--good)" }}>
                {s.bus_factor}<span className="bf-label">bus factor</span>
              </div>
              <div className="owners">
                {s.proficient_people && s.proficient_people.length
                  ? s.proficient_people.join(", ")
                  : "No proficient owners yet"}
              </div>
            </div>
          );
        })}
        {!data.skills.length && (
          <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 48, color: "var(--ink-mute)" }}>
            Add some skills and set proficiencies — gap analysis will fill in here.
          </div>
        )}
      </div>
    </>
  );
}
