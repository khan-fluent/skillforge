import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Matrix() {
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    api.matrix().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="loading"><span className="dot" /><span className="dot" /><span className="dot" /></div>;

  const cols = data.skills.length + 1;
  const gridStyle = {
    gridTemplateColumns: `220px repeat(${data.skills.length}, minmax(28px, 1fr))`,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Skill Matrix</h1>
          <p>Heatmap of every team member against every tracked skill. Brighter = deeper expertise.</p>
        </div>
        {hover && (
          <div className="card" style={{ padding: "12px 18px", minWidth: 240 }}>
            <div style={{ fontWeight: 700 }}>{hover.person} · {hover.skill}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>
              Level <span className="mono" style={{ color: "var(--cyan)" }}>{hover.level}/5</span> — {LEVEL_LABELS[hover.level]}
            </div>
          </div>
        )}
      </div>

      <div className="matrix-wrap">
        <div className="matrix" style={gridStyle}>
          <div />
          {data.skills.map((s) => (
            <div key={s.id} className="col-header">{s.name}</div>
          ))}

          {data.people.map((p) => (
            <Row key={p.id} person={p} skills={data.skills} cells={data.cells} onHover={setHover} />
          ))}
        </div>

        <div className="legend">
          <span style={{ color: "var(--text-dim)", fontSize: 12, marginRight: 8 }}>Proficiency:</span>
          {[1, 2, 3, 4, 5].map((l) => (
            <div className="item" key={l}>
              <div className={`swatch`} style={{ background: SWATCH[l] }} />
              {LEVEL_LABELS[l]}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Row({ person, skills, cells, onHover }) {
  return (
    <>
      <div className="row-header">
        {person.name} <span className="role">{person.role}</span>
      </div>
      {skills.map((s) => {
        const level = cells[`${person.id}:${s.id}`];
        return (
          <div
            key={s.id}
            className={`cell ${level ? `l${level}` : ""}`}
            onMouseEnter={() => level && onHover({ person: person.name, skill: s.name, level })}
            onMouseLeave={() => onHover(null)}
          >
            {level || ""}
          </div>
        );
      })}
    </>
  );
}

const LEVEL_LABELS = {
  1: "Novice",
  2: "Adv. Beginner",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

const SWATCH = {
  1: "rgba(34, 211, 238, 0.15)",
  2: "rgba(34, 211, 238, 0.32)",
  3: "rgba(139, 92, 246, 0.5)",
  4: "rgba(217, 70, 239, 0.7)",
  5: "linear-gradient(135deg, #d946ef, #22d3ee)",
};
