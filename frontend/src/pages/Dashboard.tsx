import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SalesRepDashboard } from "./sales/SalesRepDashboard";
import { SalesNav } from "./sales/SalesNav";
import { GrievanceAlerts } from "./sales/GrievanceAlerts";
import { CustomerNav } from "./customer/CustomerNav";
import { CustomerDashboard } from "./customer/CustomerDashboard";
import "./sales/sales.css";

// Roles that can reach the internal Sales Workspace nav (Approvals in
// particular needs Manager/Finance/Admin access, not just Sales Rep).
const NAV_ROLES = ["SALES_REP", "MANAGER", "FINANCE", "ADMIN"];

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      {user && NAV_ROLES.includes(user.role) && <SalesNav />}
      {user?.role === "CUSTOMER" && <CustomerNav />}
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "1.5rem 1.5rem 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>{user?.name}</strong>
          <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>({user?.role})</span>
        </div>
        <button className="sales-btn sales-btn-danger" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {user && NAV_ROLES.includes(user.role) ? (
        <SalesRepDashboard />
      ) : user?.role === "CUSTOMER" ? (
        <CustomerDashboard />
      ) : (
        <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
          <h1>Welcome to DealFlow360</h1>
          <p style={{ fontSize: "1.1rem" }}>
            <strong>{user?.name}</strong>
          </p>
          <p style={{ color: "var(--color-text-muted)" }}>Role: {user?.role}</p>
        </div>
      )}

      {(user?.role === "MANAGER" || user?.role === "ADMIN") && <GrievanceAlerts />}
    </div>
  );
}
