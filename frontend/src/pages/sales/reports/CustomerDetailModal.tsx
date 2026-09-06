import { useEffect, useState } from "react";
import axios from "axios";
import { getCustomerReportDetail } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { SortableHeader } from "../../../components/SortableHeader";
import type { CustomerReportDetail, SubscriptionListItem } from "../../../types/sales";
import "../sales.css";

type CustomerReportInvoice = CustomerReportDetail["invoices"][number];
type CustomerReportOrder = CustomerReportDetail["previousOrders"][number];
type CustomerReportTierChangeRequest = CustomerReportDetail["tierChangeRequests"][number];

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSubscriptionSortValue(sub: SubscriptionListItem, key: string): string | number | null {
  switch (key) {
    case "product":
      return sub.product.name;
    case "quantity":
      return sub.quantity;
    case "cycle":
      return sub.billingCycle;
    case "nextBilling":
      return new Date(sub.nextBillingDate).getTime();
    default:
      return null;
  }
}

function getInvoiceSortValue(inv: CustomerReportInvoice, key: string): string | number | null {
  switch (key) {
    case "invoiceNumber":
      return inv.invoiceNumber;
    case "amount":
      return inv.amount;
    case "status":
      return inv.status;
    case "dueDate":
      return new Date(inv.dueDate).getTime();
    default:
      return null;
  }
}

function getOrderSortValue(order: CustomerReportOrder, key: string): string | number | null {
  switch (key) {
    case "date":
      return new Date(order.createdAt).getTime();
    case "status":
      return order.status;
    case "quote":
      return order.quote?.quoteNumber ?? "";
    default:
      return null;
  }
}

function getTierRequestSortValue(req: CustomerReportTierChangeRequest, key: string): string | number | null {
  switch (key) {
    case "tier":
      return req.requestedTier;
    case "type":
      return req.type;
    case "status":
      return req.status;
    case "requested":
      return new Date(req.createdAt).getTime();
    default:
      return null;
  }
}

export function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CustomerReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subsSort = useSortableTable(detail?.subscriptions ?? [], getSubscriptionSortValue, "product");
  const invoiceSort = useSortableTable(detail?.invoices ?? [], getInvoiceSortValue, "dueDate");
  const orderSort = useSortableTable(detail?.previousOrders ?? [], getOrderSortValue, "date", "desc");
  const tierSort = useSortableTable(detail?.tierChangeRequests ?? [], getTierRequestSortValue, "requested", "desc");

  useEffect(() => {
    getCustomerReportDetail(customerId)
      .then(setDetail)
      .catch((err) => setError(errorMessage(err, "Failed to load customer details.")));
  }, [customerId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close-row">
          <button className="sales-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="banner-error">{error}</div>}
        {!error && detail === null && <p className="sales-empty">Loading...</p>}

        {detail && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {detail.customer.name} <span className="tier-badge">{detail.customer.tier}</span>
            </h1>

            <h2>Active Subscriptions</h2>
            {detail.subscriptions.length === 0 ? (
              <p className="sales-empty">No active subscriptions.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Product" sortKey="product" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                    <SortableHeader label="Quantity" sortKey="quantity" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                    <SortableHeader label="Billing Cycle" sortKey="cycle" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                    <SortableHeader label="Next Billing" sortKey="nextBilling" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {subsSort.sorted.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.product.name}</td>
                      <td>{sub.quantity}</td>
                      <td>{sub.billingCycle}</td>
                      <td>{new Date(sub.nextBillingDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>Invoices</h2>
            {detail.invoices.length === 0 ? (
              <p className="sales-empty">No invoices yet.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Invoice #" sortKey="invoiceNumber" activeKey={invoiceSort.sortKey} direction={invoiceSort.sortDirection} onSort={invoiceSort.toggleSort} />
                    <SortableHeader label="Amount" sortKey="amount" activeKey={invoiceSort.sortKey} direction={invoiceSort.sortDirection} onSort={invoiceSort.toggleSort} />
                    <SortableHeader label="Status" sortKey="status" activeKey={invoiceSort.sortKey} direction={invoiceSort.sortDirection} onSort={invoiceSort.toggleSort} />
                    <SortableHeader label="Due Date" sortKey="dueDate" activeKey={invoiceSort.sortKey} direction={invoiceSort.sortDirection} onSort={invoiceSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {invoiceSort.sorted.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoiceNumber}</td>
                      <td>{formatCurrency(inv.amount)}</td>
                      <td>
                        <span className={`status-badge status-${inv.status}`}>{inv.status}</span>
                      </td>
                      <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>Previous Orders</h2>
            {detail.previousOrders.length === 0 ? (
              <p className="sales-empty">No previous orders.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Date" sortKey="date" activeKey={orderSort.sortKey} direction={orderSort.sortDirection} onSort={orderSort.toggleSort} />
                    <th>Items</th>
                    <SortableHeader label="Status" sortKey="status" activeKey={orderSort.sortKey} direction={orderSort.sortDirection} onSort={orderSort.toggleSort} />
                    <SortableHeader label="Quote" sortKey="quote" activeKey={orderSort.sortKey} direction={orderSort.sortDirection} onSort={orderSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {orderSort.sorted.map((order) => (
                    <tr key={order.id}>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>{order.items.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}</td>
                      <td>
                        <span className={`status-badge status-${order.status}`}>{order.status}</span>
                      </td>
                      <td>{order.quote ? order.quote.quoteNumber : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>Plan Tier Change Requests</h2>
            {detail.tierChangeRequests.length === 0 ? (
              <p className="sales-empty">No plan tier change requests from this customer yet.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Requested Tier" sortKey="tier" activeKey={tierSort.sortKey} direction={tierSort.sortDirection} onSort={tierSort.toggleSort} />
                    <SortableHeader label="Type" sortKey="type" activeKey={tierSort.sortKey} direction={tierSort.sortDirection} onSort={tierSort.toggleSort} />
                    <SortableHeader label="Status" sortKey="status" activeKey={tierSort.sortKey} direction={tierSort.sortDirection} onSort={tierSort.toggleSort} />
                    <SortableHeader label="Requested" sortKey="requested" activeKey={tierSort.sortKey} direction={tierSort.sortDirection} onSort={tierSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {tierSort.sorted.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <span className="tier-badge">{req.requestedTier}</span>
                      </td>
                      <td>{req.type}</td>
                      <td>
                        <span className={`status-badge status-${req.status}`}>{req.status}</span>
                      </td>
                      <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detail.tierChangeRequests.some((r) => r.status === "PENDING") && (
              <p className="page-subtitle">
                Pending requests are decided from the Subscriptions module's company detail page.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
