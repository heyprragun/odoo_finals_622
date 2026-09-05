import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { listCustomers } from "../../api/customers";
import { createQuote } from "../../api/quotes";
import type { CustomerSummary } from "../../types/sales";
import "./sales.css";

export function NewQuote() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    listCustomers()
      .then((list) => {
        setCustomers(list);
        if (list.length > 0) setSelectedCustomerId(list[0].id);
      })
      .catch(() => setError("Failed to load customers."));
  }, []);

  async function handleCreate() {
    if (!selectedCustomerId) return;
    setError(null);
    setIsCreating(true);
    try {
      const quote = await createQuote({ customerId: selectedCustomerId });
      navigate(`/sales/quotes/${quote.id}`, { replace: true });
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to create quote."
      );
      setIsCreating(false);
    }
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Create Quote</h1>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        <h2>Select Customer</h2>
        {customers === null && !error && <p className="sales-empty">Loading customers...</p>}
        {customers && (
          <div className="product-search-row">
            <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.tier})
                </option>
              ))}
            </select>
            <button
              className="sales-btn sales-btn-primary"
              onClick={handleCreate}
              disabled={!selectedCustomerId || isCreating}
            >
              {isCreating ? "Creating..." : "Start Quote"}
            </button>
          </div>
        )}
        <p style={{ color: "#777", fontSize: "0.85rem" }}>
          You can add products and set quantities in the next step.
        </p>
      </div>
    </div>
  );
}
