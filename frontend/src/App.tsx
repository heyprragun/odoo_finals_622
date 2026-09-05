import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomerRequests } from "./pages/sales/CustomerRequests";
import { CustomerRequestDetail } from "./pages/sales/CustomerRequestDetail";
import { MyQuotes } from "./pages/sales/MyQuotes";
import { NewQuote } from "./pages/sales/NewQuote";
import { QuoteBuilder } from "./pages/sales/QuoteBuilder";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/customer-requests"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP"]}>
            <CustomerRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/customer-requests/:id"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP"]}>
            <CustomerRequestDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotes"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP"]}>
            <MyQuotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotes/new"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP"]}>
            <NewQuote />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotes/:id"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP"]}>
            <QuoteBuilder />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
