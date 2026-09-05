import { Link, useLocation } from "react-router-dom";
import "./sales.css";

// Exact order/labels per the evaluator-provided design - do not reorder,
// rename, or add tabs here without an explicit spec change.
const TABS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Quotations", path: "/sales/quotes" },
  { label: "Approvals", path: "/sales/approvals" },
  { label: "Fulfillment", path: "/sales/fulfillment" },
  { label: "Subscriptions", path: "/sales/subscriptions" },
  { label: "Invoices", path: "/sales/invoices" },
  { label: "Deal Health", path: "/sales/deal-health" },
  { label: "Reports", path: "/sales/reports" },
  { label: "Product", path: "/sales/products" },
] as const;

export function SalesNav() {
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
