import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getDealHealthOverview } from "../../api/dealHealth";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { DealHealthFlagRow, DealHealthFlagType, DealHealthOverview } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function flagTypeLabel(type: DealHealthFlagType) {
  switch (type) {
    case "STALLED":
      return "Stalled Deal";
    case "DISCOUNT_ANOMALY":
      return "Discount Anomaly";
    case "DELIVERY_SLIPPAGE":
      return "Delivery Slippage";
  }
}

function getSortValue(flag: DealHealthFlagRow, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return flag.quoteNumber;
    case "customer":
      return flag.customerName;
    case "salesRep":
      return flag.salesRepName;
    case "issue":
      return flagTypeLabel(flag.flagType);
    case "total":
      return flag.totalAmount;
    case "flaggedAt":
      return new Date(flag.flaggedAt).getTime();
    default:
      return null;
  }
}

export function DealHealth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role !== "MANAGER" && user?.role !== "ADMIN";

  const [overview, setOverview] = useState<DealHealthOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    overview?.flags ?? [],
    (flag) => `${flag.quoteNumber} ${flag.customerName} ${flag.salesRepName} ${flagTypeLabel(flag.flagType)}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "flaggedAt", "desc");

  useEffect(() => {
    if (isDenied) return;
    getDealHealthOverview()
      .then(setOverview)
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load deal health."
        );
      });
  }, [isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Deal Health" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Deal Health</h1>
          <p className="page-subtitle">
            Real-time flags for stalled deals, unusual discount patterns, and delivery slippage
          </p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="dealhealth-banners">
        <div className="dealhealth-banner stalled">
          <div className="dealhealth-banner-count">{overview?.summary.stalled ?? "—"}</div>
          <div className="dealhealth-banner-label">Stalled Deals</div>
          <p className="dealhealth-banner-desc">Quotes with no activity for a number of days.</p>
        </div>
        <div className="dealhealth-banner anomaly">
          <div className="dealhealth-banner-count">{overview?.summary.discountAnomaly ?? "—"}</div>
          <div className="dealhealth-banner-label">Discount Anomalies</div>
          <p className="dealhealth-banner-desc">Discounts significantly above a Sales Rep's historical average.</p>
        </div>
        <div className="dealhealth-banner slippage">
          <div className="dealhealth-banner-count">{overview?.summary.deliverySlippage ?? "—"}</div>
          <div className="dealhealth-banner-label">Delivery Slippage</div>
          <p className="dealhealth-banner-desc">Approved deals still short on warehouse stock past the timeline.</p>
        </div>
      </div>

      <div className="sales-card">
        <h2>Flagged Deals</h2>
        {overview === null && !error && <p className="sales-empty">Loading...</p>}
        {overview !== null && overview.flags.length === 0 && (
          <p className="sales-empty">No flagged deals right now.</p>
        )}
        {overview !== null && overview.flags.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by deal, customer, rep, or issue..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No flagged deals match this filter.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Deal" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Sales Rep" sortKey="salesRep" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Issue" sortKey="issue" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Total" sortKey="total" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Date Flagged" sortKey="flaggedAt" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((flag) => (
                    <tr
                      key={flag.id}
                      className="clickable-row"
                      onClick={() => navigate(`/sales/deal-health/${flag.quoteId}`)}
                    >
                      <td>{flag.quoteNumber}</td>
                      <td>
                        {flag.customerName} <span className="tier-badge">{flag.customerTier}</span>
                      </td>
                      <td>{flag.salesRepName}</td>
                      <td>
                        <span className={`flag-badge flag-${flag.flagType}`}>{flagTypeLabel(flag.flagType)}</span>
                        <div className="warehouse-line">{flag.issue}</div>
                      </td>
                      <td>{formatCurrency(flag.totalAmount)}</td>
                      <td>{new Date(flag.flaggedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
