import { Fragment, useState } from "react";
import axios from "axios";
import { acceptRecommendation, declineRecommendation } from "../../api/customerPortal";
import type { CustomerOrderRecommendation } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

type Mode = "accept" | "reject" | null;

interface CustomerRecommendationsProps {
  recommendations: CustomerOrderRecommendation[];
  // Recommendations live server-side keyed to the order's quote, not this
  // component's own state - simplest to just have the parent refetch the
  // whole order after any accept/reject so the list and any related order
  // data (a newly created order, in the accept case) both stay accurate.
  onActioned: () => void;
}

export function CustomerRecommendations({ recommendations, onActioned }: CustomerRecommendationsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (recommendations.length === 0) {
    return null;
  }

  function openFor(id: string, nextMode: Mode) {
    setOpenId(id);
    setMode(nextMode);
    setQuantity("1");
    setDiscount("");
    setNotes("");
    setActionError(null);
  }

  function close() {
    setOpenId(null);
    setMode(null);
  }

  async function handleAccept(id: string) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setActionError("Enter a valid quantity.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      await acceptRecommendation(id, {
        quantity: Math.floor(qty),
        expectedDiscountPercentage: discount ? Number(discount) : undefined,
        notes: notes.trim() || undefined,
      });
      setSuccessMessage("Added to your orders - you'll see it on your dashboard.");
      close();
      onActioned();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to accept this recommendation."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject(id: string) {
    setActionError(null);
    setIsSubmitting(true);
    try {
      await declineRecommendation(id);
      setSuccessMessage("Recommendation declined.");
      close();
      onActioned();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to decline this recommendation."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sales-card">
      <h2>Recommendations for You</h2>
      <p className="page-subtitle">Your Sales Rep thinks these might interest you.</p>

      {successMessage && <div className="banner-success">{successMessage}</div>}
      {actionError && <div className="banner-error">{actionError}</div>}

      <table className="sales-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Why</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec) => (
            <Fragment key={rec.id}>
              <tr>
                <td>
                  {rec.product.name} <span className="tier-badge">{rec.product.category}</span>
                </td>
                <td>{formatCurrency(rec.product.unitPrice)}</td>
                <td>{rec.reason ?? "—"}</td>
                <td>
                  {openId === rec.id ? (
                    <button className="sales-btn" onClick={close} disabled={isSubmitting}>
                      Cancel
                    </button>
                  ) : (
                    <div className="sales-actions">
                      <button
                        className="sales-btn sales-btn-primary"
                        onClick={() => openFor(rec.id, "accept")}
                      >
                        Accept
                      </button>
                      <button className="sales-btn sales-btn-danger" onClick={() => openFor(rec.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {openId === rec.id && mode === "accept" && (
                <tr>
                  <td colSpan={4}>
                    <div className="product-search-row">
                      <label>
                        Quantity:{" "}
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          style={{ width: 80 }}
                        />
                      </label>
                      <label>
                        Expected Discount %:{" "}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          style={{ width: 90 }}
                        />
                      </label>
                    </div>
                    <textarea
                      placeholder="Any comments for our sales team..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      style={{
                        width: "100%",
                        padding: "0.6rem",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        fontFamily: "inherit",
                        marginBottom: "0.75rem",
                      }}
                    />
                    <div className="sales-actions">
                      <button
                        className="sales-btn sales-btn-primary"
                        onClick={() => handleAccept(rec.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Confirm Accept"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {openId === rec.id && mode === "reject" && (
                <tr>
                  <td colSpan={4}>
                    <p style={{ margin: "0 0 0.75rem", color: "#444", fontSize: "0.88rem" }}>
                      Are you sure you want to reject this recommendation?
                    </p>
                    <div className="sales-actions">
                      <button
                        className="sales-btn sales-btn-danger"
                        onClick={() => handleReject(rec.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Confirm Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
