import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const STATUS_PILL = {
  expired: "rose",
  expiring_soon: "amber",
  valid: "emerald",
  no_expiry: "cyan",
};
const STATUS_LABEL = {
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  valid: "Valid",
  no_expiry: "No Expiry",
};

export default function Certifications() {
  const [certs, setCerts] = useState([]);
  useEffect(() => { api.certifications().then(setCerts).catch(console.error); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Certifications</h1>
          <p>Every credential the team holds, sorted by upcoming expiry.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <th style={{ padding: "16px 24px" }}>Person</th>
              <th>Certification</th>
              <th>Issuer</th>
              <th>Expires</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 24px", fontWeight: 600 }}>{c.person_name}</td>
                <td>{c.name}</td>
                <td style={{ color: "var(--text-dim)" }}>{c.issuer}</td>
                <td className="mono" style={{ color: "var(--text-dim)" }}>{c.expires_on || "—"}</td>
                <td><span className={`pill ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
