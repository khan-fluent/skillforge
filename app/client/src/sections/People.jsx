import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function People() {
  const [people, setPeople] = useState([]);
  useEffect(() => { api.people().then(setPeople).catch(console.error); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>People</h1>
          <p>Every member of the team and their skill footprint.</p>
        </div>
      </div>

      <div className="people-grid">
        {people.map((p) => (
          <div key={p.id} className="person-card">
            <div className="avatar">{p.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</div>
            <div className="name">{p.name}</div>
            <div className="role">{p.role}</div>
            <div style={{ marginTop: 10 }}>
              <span className="pill cyan">{p.team}</span>
            </div>
            <div className="stats">
              <div className="stat">Skills <strong>{p.skill_count}</strong></div>
              <div className="stat">Avg level <strong>{p.avg_level.toFixed(1)}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
