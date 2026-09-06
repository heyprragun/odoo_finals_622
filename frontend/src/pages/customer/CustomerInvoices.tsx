import { useEffect, useState } from "react";
import axios from "axios";
import { downloadMyInvoicePdf, listMyInvoices } from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { CustomerInvoiceItem, CustomerInvoicesResponse } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSortValue(invoice: CustomerInvoiceItem, key: string): string | number | null {
  switch (key) {
    case "invoiceNumber":
      return invoice.invoiceNumber;
    case "reference":
      return invoice.reference;
    case "amount":
      return invoice.amount;
    case "dueDate":
      return new Date(invoice.dueDate).getTime();
    default:
      return null;
  }
}

function InvoiceTable({
  invoices,
  emptyText,
  allowDownload,
}: {
  invoices: CustomerInvoiceItem[];
  emptyText: string;
  allowDownload?: boolean;
}) {
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(invoices, getSortValue, "dueDate");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (invoices.length === 0) {
    return <p className="sales-empty">{emptyText}</p>;
  }

  async function handleDownload(invoice: CustomerInvoiceItem) {
    setDownloadError(null);
    setDownloadingId(invoice.id);
    try {
      await downloadMyInvoicePdf(invoice.id, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setDownloadError(errorMessage(err, "Failed to download this invoice."));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      {downloadError && <div className="banner-error">{downloadError}</div>}
      <table className="sales-table">
        <thead>
          <tr>
            <SortableHeader label="Invoice #" sortKey="invoiceNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <SortableHeader label="Order" sortKey="reference" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <SortableHeader label="Due Date" sortKey="dueDate" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            {allowDownload && <th></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.invoiceNumber}</td>
              <td>{invoice.reference}</td>
              <td>{formatCurrency(invoice.amount)}</td>
              <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
              {allowDownload && (
                <td>
                  <button
                    className="sales-btn"
                    onClick={() => handleDownload(invoice)}
                    disabled={downloadingId === invoice.id}
                  >
                    {downloadingId === invoice.id ? "Downloading..." : "Download PDF"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
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
          <InvoiceTable invoices={invoices.paid} emptyText="No paid invoices yet." allowDownload />
        )}
      </div>
    </div>
  );
}
