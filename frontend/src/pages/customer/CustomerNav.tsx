import { Link, useLocation } from "react-router-dom";
import "../sales/sales.css";

// Customer-facing portal nav - deliberately separate from SalesNav. Customer
// must never see the internal Sales Workspace tabs (Quotations, Approvals,
// Fulfillment, etc.), only these five.
const TABS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Subscriptions", path: "/portal/subscriptions" },
  { label: "Create New Request", path: "/portal/requests/new" },
  { label: "Invoices", path: "/portal/invoices" },
  { label: "Negotiations", path: "/portal/negotiations" },
] as const;

export function CustomerNav() {
  const location = useLocation();

  return (
    <nav className="sales-nav">
      {TABS.map((tab) => {
        const isActive =
          tab.path === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(tab.path);
        return (
          <Link key={tab.path} to={tab.path} className={`sales-nav-tab${isActive ? " active" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
