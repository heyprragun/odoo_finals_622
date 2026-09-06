import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getCustomerRequest } from "../../api/customerRequests";
import { createQuote } from "../../api/quotes";
import type { CustomerRequestDetail as CustomerRequestDetailType } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function CustomerRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSalesRep = user?.role === "SALES_REP";
  const [request, setRequest] = useState<CustomerRequestDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCustomerRequest(id)
      .then(setRequest)
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load this customer request."
        );
      });
  }, [id]);

  async function handleCreateQuote() {
    if (!id) return;
    setError(null);
    setIsCreating(true);
    try {
      // If this request already has a linked quote, the backend returns it
      // instead of creating a duplicate - either way we land on the builder.
      const quote = await createQuote({ customerRequestId: id });
      navigate(`/sales/quotes/${quote.id}`);
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to create quote from this request."
      );
      setIsCreating(false);
    }
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Customer Request Details</h1>
        <Link className="sales-back-link" to="/sales/customer-requests">
          ← Back to customer requests
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {!request && !error && <p className="sales-empty">Loading...</p>}

      {request && (
        <>
          <div className="sales-card">
            <h2>Customer</h2>
            <p>
              <strong>{request.customer.name}</strong>{" "}
              <span className="tier-badge">{request.customer.tier}</span>
            </p>
            <p>
              Status: <span className={`status-badge status-${request.status}`}>{request.status}</span>
            </p>
            <p>
              Customer's Expected Discount:{" "}
              <strong>
                {request.expectedDiscountPercentage !== null ? `${request.expectedDiscountPercentage}%` : "Not specified"}
              </strong>
            </p>
            <p>
              Ship To: <strong>{request.shippingLocation ?? "Not specified"}</strong>
            </p>
            {request.notes && <p style={{ color: "#555" }}>Notes: {request.notes}</p>}
          </div>

          {request.modifiesSubscription && (
            <div className="banner-error">
              This is a <strong>plan change request</strong> for an existing subscription:{" "}
              <strong>{request.modifiesSubscription.productName}</strong> (x{request.modifiesSubscription.quantity}
              ), currently billed <strong>{request.modifiesSubscription.currentBillingCycle}</strong>. Approving
              the resulting quote will cancel that subscription and replace it with a new one on the requested
              cycle below.
            </div>
          )}

          <div className="sales-card">
            <h2>Requested Products</h2>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Selling Price</th>
                  <th>Requested Qty</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product.name}</td>
                    <td>{item.product.sku}</td>
                    <td>{formatCurrency(item.product.unitPrice)}</td>
                    <td>{item.requestedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sales-actions">
            {request.quote ? (
              <button
                className="sales-btn sales-btn-primary"
                onClick={() => navigate(`/sales/quotes/${request.quote!.id}`)}
              >
                View Quote ({request.quote.quoteNumber})
              </button>
            ) : (
              isSalesRep && (
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={handleCreateQuote}
                  disabled={isCreating || request.status === "CANCELLED"}
                >
                  {isCreating ? "Creating..." : "Create Quote"}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
