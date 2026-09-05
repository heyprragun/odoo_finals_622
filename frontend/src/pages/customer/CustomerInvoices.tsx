import { useEffect, useState } from "react";
import axios from "axios";
import { listMyInvoices } from "../../api/customerPortal";
import type { CustomerInvoiceItem, CustomerInvoicesResponse } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function InvoiceTable({ invoices, emptyText }: { invoices: CustomerInvoiceItem[]; emptyText: string }) {
  if (invoices.length === 0) {
    return <p className="sales-empty">{emptyText}</p>;
  }
  return (
    <table className="sales-table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Order</th>
          <th>Amount</th>
          <th>Due Date</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>{invoice.invoiceNumber}</td>
            <td>{invoice.reference}</td>
            <td>{formatCurrency(invoice.amount)}</td>
            <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CustomerInvoices() {
  const [invoices, setInvoices] = useState<CustomerInvoicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyInvoices()
      .then(setInvoices)
      .catch((err) => setError(errorMessage(err, "Failed to load your invoices.")));
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Invoices</h1>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        <h2>Unpaid</h2>
        {invoices === null ? (
          <p className="sales-empty">Loading...</p>
        ) : (
          <InvoiceTable invoices={invoices.unpaid} emptyText="No unpaid invoices." />
        )}
      </div>

      <div className="sales-card">
        <h2>Paid</h2>
        {invoices === null ? (
          <p className="sales-empty">Loading...</p>
        ) : (
          <InvoiceTable invoices={invoices.paid} emptyText="No paid invoices yet." />
        )}
      </div>
    </div>
  );
}
