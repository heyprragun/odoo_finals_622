import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NoAccessBlock } from "./NoAccessBlock";
import { ReportsOverviewTab } from "./reports/ReportsOverviewTab";
import { TeamPerformanceTab } from "./reports/TeamPerformanceTab";
import { QuotationsTab } from "./reports/QuotationsTab";
import { ProductPerformanceTab } from "./reports/ProductPerformanceTab";
import { CustomerTiersTab } from "./reports/CustomerTiersTab";
import { AiInsightsTab } from "./reports/AiInsightsTab";
import { downloadReportExport } from "../../api/reports";
import "./sales.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "team", label: "Team" },
  { key: "quotations", label: "Quotations" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
  { key: "ai", label: "AI Insights" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function Reports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isExporting, setIsExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  if (user?.role !== "ADMIN") {
    return <NoAccessBlock title="Reports" />;
  }

  async function handleExport(format: "pdf" | "xlsx") {
    setExportError(null);
    setIsExporting(format);
    try {
      await downloadReportExport(format);
    } catch {
      setExportError(`Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">Company-wide performance across teams, orders, products and customers</p>
        </div>
        <div className="sales-actions">
          <button className="sales-btn" onClick={() => handleExport("pdf")} disabled={isExporting !== null}>
            {isExporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <button className="sales-btn" onClick={() => handleExport("xlsx")} disabled={isExporting !== null}>
            {isExporting === "xlsx" ? "Exporting..." : "Export XLSX"}
          </button>
        </div>
      </div>

      {exportError && <div className="banner-error">{exportError}</div>}

      <nav className="reports-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`reports-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && <ReportsOverviewTab />}
      {activeTab === "team" && <TeamPerformanceTab />}
      {activeTab === "quotations" && <QuotationsTab />}
      {activeTab === "products" && <ProductPerformanceTab />}
      {activeTab === "customers" && <CustomerTiersTab />}
      {activeTab === "ai" && <AiInsightsTab />}
    </div>
  );
}
