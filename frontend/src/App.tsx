import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SalesLayout } from "./pages/sales/SalesLayout";
import { CustomerRequests } from "./pages/sales/CustomerRequests";
import { CustomerRequestDetail } from "./pages/sales/CustomerRequestDetail";
import { MyQuotes } from "./pages/sales/MyQuotes";
import { NewQuote } from "./pages/sales/NewQuote";
import { QuoteBuilder } from "./pages/sales/QuoteBuilder";
import { Products } from "./pages/sales/Products";
import { ComingSoon } from "./pages/sales/ComingSoon";
import { Approvals } from "./pages/sales/Approvals";
import { ApprovalDetail } from "./pages/sales/ApprovalDetail";
import { Fulfillment } from "./pages/sales/Fulfillment";
import { FulfillmentDetail } from "./pages/sales/FulfillmentDetail";
import { Subscriptions } from "./pages/sales/Subscriptions";
import { CompanySubscriptionDetail } from "./pages/sales/CompanySubscriptionDetail";
import { DealHealth } from "./pages/sales/DealHealth";
import { Invoices } from "./pages/sales/Invoices";
import { InvoiceDetail } from "./pages/sales/InvoiceDetail";
import { ProductEdit } from "./pages/sales/ProductEdit";
import { CustomerLayout } from "./pages/customer/CustomerLayout";
import { DiscountSettings } from "./pages/sales/DiscountSettings";
import { CustomerSubscriptions } from "./pages/customer/CustomerSubscriptions";
import { CreateCustomerRequest } from "./pages/customer/CreateCustomerRequest";
import { CustomerInvoices } from "./pages/customer/CustomerInvoices";
import { Negotiations } from "./pages/customer/Negotiations";
import { CustomerOrderDetail } from "./pages/customer/CustomerOrderDetail";

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
        path="/sales"
        element={
          <ProtectedRoute allowedRoles={["SALES_REP", "MANAGER", "FINANCE", "ADMIN"]}>
            <SalesLayout />
          </ProtectedRoute>
        }
      >
        <Route path="customer-requests" element={<CustomerRequests />} />
        <Route path="customer-requests/:id" element={<CustomerRequestDetail />} />
        <Route path="quotes" element={<MyQuotes />} />
        <Route path="quotes/new" element={<NewQuote />} />
        <Route path="quotes/:id" element={<QuoteBuilder />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductEdit />} />
        <Route path="products/:id" element={<ProductEdit />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="approvals/:id" element={<ApprovalDetail />} />
        <Route path="fulfillment" element={<Fulfillment />} />
        <Route path="fulfillment/:productId" element={<FulfillmentDetail />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:customerId" element={<CompanySubscriptionDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="deal-health" element={<DealHealth />} />
        <Route
          path="reports"
          element={<ComingSoon title="Reports" deniedRoles={["SALES_REP", "MANAGER", "FINANCE"]} />}
        />
        <Route path="discount-settings" element={<DiscountSettings />} />
      </Route>

      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="orders/:id" element={<CustomerOrderDetail />} />
        <Route path="subscriptions" element={<CustomerSubscriptions />} />
        <Route path="requests/new" element={<CreateCustomerRequest />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="negotiations" element={<Negotiations />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
