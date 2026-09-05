import { useAuth } from "../../context/AuthContext";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

// Plain frontend shell only - no backend endpoint exists yet for any of
// this. Every count/row below is a static placeholder until the deal health
// engine (stalled-deal detection, discount anomaly scoring, delivery
// slippage tracking) is wired in.
type FlagType = "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE";

interface FlaggedDeal {
  id: string;
  quoteNumber: string;
  customerName: string;
  issue: string;
  flagType: FlagType;
  flaggedAt: string;
}

const STALLED_COUNT = 0;
const DISCOUNT_ANOMALY_COUNT = 0;
const DELIVERY_SLIPPAGE_COUNT = 0;
const FLAGGED_DEALS: FlaggedDeal[] = [];

function flagTypeLabel(type: FlagType) {
  switch (type) {
    case "STALLED":
      return "Stalled Deal";
    case "DISCOUNT_ANOMALY":
      return "Discount Anomaly";
    case "DELIVERY_SLIPPAGE":
      return "Delivery Slippage";
  }
}

export function DealHealth() {
  const { user } = useAuth();

  if (user?.role !== "MANAGER" && user?.role !== "ADMIN") {
    return <NoAccessBlock title="Deal Health" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Deal Health</h1>
          <p className="page-subtitle">
            Real-time flags for stalled deals and unusual discount patterns
          </p>
        </div>
      </div>

      <div className="dealhealth-banners">
        <div className="dealhealth-banner stalled">
          <div className="dealhealth-banner-count">{STALLED_COUNT}</div>
          <div className="dealhealth-banner-label">Stalled Deals</div>
          <p className="dealhealth-banner-desc">Quotes with no activity for a configured number of days.</p>
        </div>
        <div className="dealhealth-banner anomaly">
          <div className="dealhealth-banner-count">{DISCOUNT_ANOMALY_COUNT}</div>
          <div className="dealhealth-banner-label">Discount Anomalies</div>
          <p className="dealhealth-banner-desc">Discounts significantly above a Sales Rep's historical average.</p>
        </div>
        <div className="dealhealth-banner slippage">
          <div className="dealhealth-banner-count">{DELIVERY_SLIPPAGE_COUNT}</div>
          <div className="dealhealth-banner-label">Delivery Slippage</div>
          <p className="dealhealth-banner-desc">Deals whose expected delivery date has slipped.</p>
        </div>
      </div>

      <div className="sales-card">
        <h2>Flagged Deals</h2>
        {FLAGGED_DEALS.length === 0 ? (
          <p className="sales-empty">
            No flagged deals yet. This view will populate once the deal health engine is connected.
          </p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Customer</th>
                <th>Issue</th>
                <th>Date Flagged</th>
              </tr>
            </thead>
            <tbody>
              {FLAGGED_DEALS.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.quoteNumber}</td>
                  <td>{deal.customerName}</td>
                  <td>{flagTypeLabel(deal.flagType)}</td>
                  <td>{new Date(deal.flaggedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
