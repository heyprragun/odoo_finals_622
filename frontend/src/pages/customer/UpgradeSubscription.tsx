import { useEffect, useState } from "react";
import axios from "axios";
import { getMyTierChangeInfo, requestTierChange } from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { CustomerTier, MyTierChangeInfo, MyTierChangeRequest } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

const TIERS: CustomerTier[] = ["GOLD", "SILVER", "BRONZE"];

function getSortValue(req: MyTierChangeRequest, key: string): string | number | null {
  switch (key) {
    case "tier":
      return req.requestedTier;
    case "type":
      return req.type;
    case "status":
      return req.status;
    case "requested":
      return new Date(req.createdAt).getTime();
    default:
      return null;
  }
}

// Requests a change to the COMPANY's overall plan tier (Gold/Silver/Bronze)
// - this is what drives discount-governance limits, not any single
// product's subscription. Admin reviews and decides every request.
export function UpgradeSubscription() {
  const [info, setInfo] = useState<MyTierChangeInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestedTier, setRequestedTier] = useState<CustomerTier>("GOLD");
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    getMyTierChangeInfo()
      .then((data) => {
        setInfo(data);
        setRequestedTier(data.currentTier);
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load your plan tier.")));
  }

  useEffect(load, []);

  const hasPending = info?.requests.some((r) => r.status === "PENDING") ?? false;
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(
    info?.requests ?? [],
    getSortValue,
    "requested",
    "desc"
  );

  async function handleSubmit() {
    if (!info) return;
    if (requestedTier === info.currentTier) {
      setActionError("Choose a tier different from your current one.");
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await requestTierChange({ requestedTier, note: note.trim() || undefined });
      setSuccessMessage("Your request has been sent to the Admin for review.");
      setNote("");
      load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to submit your request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) return <div className="banner-error">{loadError}</div>;

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Upgrade Subscription</h1>
          <p className="page-subtitle">
            Request an upgrade or downgrade to your company's plan tier - Admin reviews every request.
          </p>
        </div>
      </div>

      {successMessage && <div className="banner-success">{successMessage}</div>}
      {actionError && <div className="banner-error">{actionError}</div>}

      {info === null ? (
        <div className="sales-card">
          <p className="sales-empty">Loading...</p>
        </div>
      ) : (
        <>
          <div className="sales-card">
            <h2>Current Plan</h2>
            <p>
              <span className="tier-badge">{info.currentTier}</span>
            </p>

            <div className="product-search-row" style={{ marginTop: "1rem" }}>
              <label>
                Request Tier:{" "}
                <select
                  value={requestedTier}
                  onChange={(e) => setRequestedTier(e.target.value as CustomerTier)}
                  disabled={hasPending}
                >
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              placeholder="Why do you want this change? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={hasPending}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontFamily: "inherit",
                margin: "0.75rem 0",
              }}
            />
            <div className="sales-actions">
              <button
                className="sales-btn sales-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || hasPending}
                title={hasPending ? "You already have a pending tier change request" : undefined}
              >
                {isSubmitting ? "Submitting..." : "Send Request"}
              </button>
            </div>
          </div>

          <div className="sales-card">
            <h2>Request History</h2>
            {info.requests.length === 0 ? (
              <p className="sales-empty">You haven't requested a plan change yet.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Requested Tier" sortKey="tier" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Requested" sortKey="requested" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((req) => (
                    <tr key={req.id}>
                      <td>{req.requestedTier}</td>
                      <td>{req.type}</td>
                      <td>
                        <span className={`status-badge status-${req.status}`}>{req.status}</span>
                      </td>
                      <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
