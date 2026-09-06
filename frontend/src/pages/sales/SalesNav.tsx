import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getInternalNavAlerts } from "../../api/navAlerts";
import type { Role } from "../../types/auth";
import type { InternalNavAlerts } from "../../types/sales";
import "./sales.css";

// Exact order/labels per the evaluator-provided design, plus later
// explicitly-requested additions (Audit Trail) - do not reorder, rename, or
// add tabs here without an explicit spec change.
// alertKey ties a tab to a field on InternalNavAlerts (see
// navAlerts.service.ts) - omitted for tabs that don't have a "something
// changed here" concept (Dashboard, Quotations, Fulfillment, Invoices,
// Reports, Product, Discount Settings).
// roles: omit for a tab every internal role can see (matches its page's own
// gate having no role check at all - Dashboard, Quotations, Approvals, Audit
// Trail, Subscriptions); list explicitly for a tab whose page 403s/blocks
// some roles, mirroring that page's own isDenied/isAllowed check exactly -
// keep these two in sync if a page's own gate ever changes.
interface NavTab {
  label: string;
  path: string;
  alertKey?: keyof InternalNavAlerts;
  roles?: Role[];
}

const TABS: NavTab[] = [
  { label: "Dashboard", path: "/dashboard", alertKey: "grievances" },
  { label: "Quotations", path: "/sales/quotes" },
  { label: "Approvals", path: "/sales/approvals", alertKey: "approvals" },
  { label: "Audit Trail", path: "/sales/audit-trail", alertKey: "auditTrail" },
  { label: "Fulfillment", path: "/sales/fulfillment", roles: ["SALES_REP", "MANAGER", "ADMIN"] },
  { label: "Subscriptions", path: "/sales/subscriptions", alertKey: "subscriptions" },
  { label: "Invoices", path: "/sales/invoices", roles: ["FINANCE", "ADMIN"] },
  { label: "Deal Health", path: "/sales/deal-health", alertKey: "dealHealth", roles: ["MANAGER", "ADMIN"] },
  {
    label: "Stock Conflicts",
    path: "/sales/stock-conflicts",
    alertKey: "stockConflicts",
    roles: ["MANAGER", "ADMIN"],
  },
  { label: "Reports", path: "/sales/reports", roles: ["ADMIN"] },
  { label: "Product", path: "/sales/products", roles: ["SALES_REP", "MANAGER", "ADMIN"] },
  { label: "Warehouses", path: "/sales/warehouses", roles: ["ADMIN"] },
  { label: "Discount Settings", path: "/sales/discount-settings", roles: ["ADMIN"] },
];

export function SalesNav() {
  const location = useLocation();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InternalNavAlerts | null>(null);

  // Refetched on every navigation (not just once on mount) - the nav stays
  // mounted across sibling /sales/* pages, and an action on one page (e.g.
  // approving a quote) can change what another tab should flag.
  useEffect(() => {
    getInternalNavAlerts()
      .then(setAlerts)
      .catch(() => setAlerts(null));
  }, [location.pathname]);

  const visibleTabs = TABS.filter((tab) => !tab.roles || (!!user && tab.roles.includes(user.role)));

  return (
    <nav className="sales-nav">
      <span className="sales-nav-brand">DealFlow360</span>
      {visibleTabs.map((tab) => {
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
