import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listGrievances } from "../../api/grievances";
import type { GrievanceSummary } from "../../types/sales";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

/**
 * Manager/Admin-only alerts section, placed directly below the shared
 * dashboard (see Dashboard.tsx) - every grievance any customer has raised,
 * across every Sales Rep's orders, in one place. Never shown to Sales Rep
 * or Finance - grievances are a Manager/Admin concern only.
 */
export function GrievanceAlerts() {
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState<GrievanceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGrievances()
      .then(setGrievances)
      .catch((err) => setError(errorMessage(err, "Failed to load grievances.")));
  }, []);

  const openCount = grievances?.filter((g) => g.status === "OPEN").length ?? 0;

  return (
    <div className="sales-page" style={{ paddingTop: 0 }}>
      <div className="sales-card">
        <div className="sales-header" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Grievance Alerts</h2>
          {openCount > 0 && <span className="status-badge status-OPEN">{openCount} Open</span>}
        </div>

        {error && <div className="banner-error">{error}</div>}
        {grievances === null && !error && <p className="sales-empty">Loading...</p>}
        {grievances !== null && grievances.length === 0 && (
          <p className="sales-empty">No grievances have been raised.</p>
        )}
        {grievances !== null && grievances.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Order</th>
                <th>Issue</th>
                <th>Messages</th>
                <th>Raised</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {grievances.map((g) => (
                <tr key={g.id} className="clickable-row" onClick={() => navigate(`/sales/grievances/${g.id}`)}>
                  <td>
                    {g.customer.name} <span className="tier-badge">{g.customer.tier}</span>
                  </td>
                  <td>{g.quote.quoteNumber}</td>
                  <td>{g.description.length > 60 ? `${g.description.slice(0, 60)}...` : g.description}</td>
                  <td>{g.messageCount}</td>
                  <td>{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${g.status}`}>{g.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
