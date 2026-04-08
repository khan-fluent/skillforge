import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Gaps() {
  const [data, setData] = useState(null);
  useEffect(() => { api.gaps().then(setData).catch(console.error); }, []);

  if (!data) return <div className="loading"><span className="dot" /><span className="dot" /><span className="dot" /></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Knowledge Gaps</h1>
          <p>Bus-factor analysis. A skill with 0 or 1 proficient owners is a continuity risk.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card">
          <h3>Critical</h3>
          <div className="value" style={{ color: "var(--rose)" }}>{data.summary.critical}</div>
          <div className="sub">no proficient owner</div>
        </div>
        <div className="card">
          <h3>High Risk</h3>
          <div className="value" style={{ color: "var(--amber)" }}>{data.summary.high_risk}</div>
          <div className="sub">single point of failure</div>
        </div>
        <div className="card">
          <h3>Healthy</h3>
          <div className="value" style={{ color: "var(--emerald)" }}>{data.summary.healthy}</div>
          <div className="sub">2+ proficient owners</div>
        </div>
      </div>

      <div className="gap-grid">
        {data.skills.map((s) => {
          const tier = s.bus_factor === 0 ? "critical" : s.bus_factor === 1 ? "high" : "";
          return (
            <div key={s.id} className={`gap-card ${tier}`}>
              <div className="domain">{s.domain}</div>
              <div className="skill-name">{s.name}</div>
              <div className="bus-factor" style={{ color: s.bus_factor === 0 ? "var(--rose)" : s.bus_factor === 1 ? "var(--amber)" : "var(--emerald)" }}>
                {s.bus_factor}<span className="label">bus factor</span>
              </div>
              <div className="owners">
                {s.proficient_people && s.proficient_people.length
                  ? s.proficient_people.join(", ")
                  : "No proficient owners"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
