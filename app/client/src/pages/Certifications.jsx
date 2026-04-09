import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const STATUS = {
  expired:        { pill: "bad",  label: "Expired" },
  expiring_soon:  { pill: "warn", label: "Expiring soon" },
  valid:          { pill: "good", label: "Valid" },
  no_expiry:      { pill: "",     label: "No expiry" },
};

export default function Certifications() {
  const [certs, setCerts] = useState([]);
  useEffect(() => { api.certifications().then(setCerts).catch(() => {}); }, []);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Certifications</h1>
          <p>Every credential the team holds, sorted by upcoming expiry.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-mute)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "18px 28px" }}>Person</th>
              <th>Certification</th>
              <th>Issuer</th>
              <th>Expires</th>
              <th style={{ paddingRight: 28 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 28px", fontWeight: 600, fontSize: 14 }}>{c.person_name}</td>
                <td style={{ fontSize: 14 }}>{c.name}</td>
                <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{c.issuer}</td>
                <td className="mono" style={{ color: "var(--ink-soft)", fontSize: 13 }}>{c.expires_on || "—"}</td>
                <td style={{ paddingRight: 28 }}><span className={`pill ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span></td>
              </tr>
            ))}
            {!certs.length && (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: "center", color: "var(--ink-mute)" }}>No certifications tracked yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
