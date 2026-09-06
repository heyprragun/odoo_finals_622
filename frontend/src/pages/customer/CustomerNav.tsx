import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCustomerNavAlerts } from "../../api/customerPortal";
import type { CustomerNavAlerts } from "../../types/sales";
import "../sales/sales.css";

// Customer-facing portal nav - deliberately separate from SalesNav. Customer
// must never see the internal Sales Workspace tabs (Quotations, Approvals,
// Fulfillment, etc.), only these seven.
// alertKey ties a tab to a field on CustomerNavAlerts (see
// navAlerts.service.ts) - omitted for tabs with no "something changed here"
// concept (Dashboard, Create New Request, Recurring Plans, Invoices).
interface NavTab {
  label: string;
  path: string;
  alertKey?: keyof CustomerNavAlerts;
}

const TABS: NavTab[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Subscriptions", path: "/portal/subscriptions", alertKey: "subscriptions" },
  { label: "Upgrade Subscription", path: "/portal/upgrade-subscription", alertKey: "upgradeSubscription" },
  { label: "Create New Request", path: "/portal/requests/new" },
  { label: "Recurring Plans", path: "/portal/recurring-plans" },
  { label: "Invoices", path: "/portal/invoices" },
  { label: "Negotiations", path: "/portal/negotiations", alertKey: "negotiations" },
  { label: "Grievances", path: "/portal/grievances" },
];

export function CustomerNav() {
  const location = useLocation();
  const [alerts, setAlerts] = useState<CustomerNavAlerts | null>(null);

  // Refetched on every navigation - the nav stays mounted across sibling
  // /portal/* pages, and resolving something on one page (e.g. a discount
  // review) can change what another tab should flag.
  useEffect(() => {
    getCustomerNavAlerts()
      .then(setAlerts)
      .catch(() => setAlerts(null));
  }, [location.pathname]);

  return (
    <nav className="sales-nav">
      <span className="sales-nav-brand">DealFlow360</span>
      {TABS.map((tab) => {
        const isActive =
          tab.path === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(tab.path);
        const hasAlert = tab.alertKey ? Boolean(alerts?.[tab.alertKey]) : false;
        return (
          <Link key={tab.path} to={tab.path} className={`sales-nav-tab${isActive ? " active" : ""}`}>
            {tab.label}
            {hasAlert && <span className="nav-dot" title="New activity to check" />}
          </Link>
        );
      })}
    </nav>
  );
}
