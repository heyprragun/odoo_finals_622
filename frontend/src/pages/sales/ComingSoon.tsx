import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types/auth";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

interface ComingSoonProps {
  title: string;
  // Roles that should see a "no access" block instead of the coming-soon
  // message - mirrors what already happens for e.g. Finance on Quotations
  // (backend returns 403), except these pages have no backend yet, so the
  // gate has to live here on the frontend for now.
  deniedRoles?: Role[];
}

// Honest placeholder for nav tabs whose modules are future phases (Invoices,
// Deal Health, Reports) - the tab is visible per the required navigation
// design, but nothing is faked behind it.
export function ComingSoon({ title, deniedRoles }: ComingSoonProps) {
  const { user } = useAuth();
  const isDenied = !!user && !!deniedRoles?.includes(user.role);

  if (isDenied) {
    return <NoAccessBlock title={title} />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>{title}</h1>
      </div>
      <div className="sales-card">
        <p className="sales-empty">{title} is not available yet. This module is planned for a future phase.</p>
      </div>
    </div>
  );
}
