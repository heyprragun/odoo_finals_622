import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SalesRepDashboard } from "./sales/SalesRepDashboard";
import { SalesNav } from "./sales/SalesNav";

// Roles that can reach the shared nav (Approvals in particular needs
// Manager/Finance/Admin access, not just Sales Rep).
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
          <span style={{ color: "#555", marginLeft: "0.5rem" }}>({user?.role})</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "0.5rem 1rem",
            background: "#e53935",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {user && NAV_ROLES.includes(user.role) ? (
        <SalesRepDashboard />
      ) : (
        <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
          <h1>Welcome to DealFlow360</h1>
          <p style={{ fontSize: "1.1rem" }}>
            <strong>{user?.name}</strong>
          </p>
          <p style={{ color: "#555" }}>Role: {user?.role}</p>
        </div>
      )}
    </div>
  );
}
