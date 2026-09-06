import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { listCustomerRequests } from "../../api/customerRequests";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { CustomerRequestListItem } from "../../types/sales";
import "./sales.css";

function getSortValue(request: CustomerRequestListItem, key: string): string | number | null {
  switch (key) {
    case "customer":
      return request.customer.name;
    case "date":
      return new Date(request.createdAt).getTime();
    case "status":
      return request.status;
    case "items":
      return request.itemCount;
    default:
      return null;
  }
}

export function CustomerRequests() {
  const [requests, setRequests] = useState<CustomerRequestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    requests ?? [],
    (r) => `${r.customer.name} ${r.status}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "date", "desc");

  useEffect(() => {
    listCustomerRequests()
      .then(setRequests)
      .catch((err) => {
        setError(axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to load customer requests.");
      });
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Customer Requests</h1>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {requests === null && !error && <p className="sales-empty">Loading...</p>}
        {requests !== null && requests.length === 0 && (
          <p className="sales-empty">No customer requests yet.</p>
        )}
        {requests !== null && requests.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by customer or status..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No requests match this filter.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Request Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Items" sortKey="items" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.customer.name} <span className="tier-badge">{r.customer.tier}</span>
                      </td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge status-${r.status}`}>{r.status}</span>
                      </td>
                      <td>{r.itemCount}</td>
                      <td>
                        <Link className="sales-btn" to={`/sales/customer-requests/${r.id}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
