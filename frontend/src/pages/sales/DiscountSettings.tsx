import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getGovernanceSettings, updateGovernanceSettings } from "../../api/governance";
import type {
  CategoryDiscountLimitEntry,
  CustomerTier,
  ProductCategory,
  TierDiscountLimitEntry,
} from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

const TIER_ORDER: CustomerTier[] = ["GOLD", "SILVER", "BRONZE"];
const CATEGORY_ORDER: ProductCategory[] = ["HARDWARE", "SERVICE", "SUBSCRIPTION"];

function sortByOrder<T, K>(items: T[], order: K[], keyOf: (item: T) => K): T[] {
  return [...items].sort((a, b) => order.indexOf(keyOf(a)) - order.indexOf(keyOf(b)));
}

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

export function DiscountSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [tierLimits, setTierLimits] = useState<TierDiscountLimitEntry[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<CategoryDiscountLimitEntry[]>([]);
  const [overByThreshold, setOverByThreshold] = useState("10");
  const [breachCountMin, setBreachCountMin] = useState("2");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getGovernanceSettings()
      .then((settings) => {
        setTierLimits(sortByOrder(settings.tierLimits, TIER_ORDER, (t) => t.tier));
        setCategoryLimits(sortByOrder(settings.categoryLimits, CATEGORY_ORDER, (c) => c.category));
        setOverByThreshold(String(settings.riskSettings.highRiskOverByThreshold));
        setBreachCountMin(String(settings.riskSettings.highRiskBreachCountMin));
        setIsLoaded(true);
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load discount settings.")));
  }, [isAdmin]);

  if (!isAdmin) {
    return <NoAccessBlock title="Discount Settings" />;
  }

  function updateTier(tier: CustomerTier, value: string) {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setTierLimits((prev) => prev.map((t) => (t.tier === tier ? { ...t, maxDiscountPercentage: num } : t)));
  }

  function updateCategory(category: ProductCategory, value: string) {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setCategoryLimits((prev) =>
      prev.map((c) => (c.category === category ? { ...c, maxDiscountPercentage: num } : c))
    );
  }

  async function handleSave() {
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      await updateGovernanceSettings({
        tierLimits,
        categoryLimits,
        riskSettings: {
          highRiskOverByThreshold: Math.max(0, Number(overByThreshold) || 0),
          highRiskBreachCountMin: Math.max(1, Math.floor(Number(breachCountMin) || 1)),
        },
      });
      setSaveMessage("Settings saved.");
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save settings."));
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Discount Settings</h1>
          <p className="page-subtitle">Discount tiers and the approval-routing logic that depends on them</p>
        </div>
      </div>

      {saveError && <div className="banner-error">{saveError}</div>}
      {saveMessage && <div className="banner-success">{saveMessage}</div>}

      {!isLoaded ? (
        <div className="sales-card">
          <p className="sales-empty">Loading...</p>
        </div>
      ) : (
        <>
          <div className="sales-card">
            <h2>Customer Tier Discount Thresholds</h2>
            <p className="page-subtitle">
              The maximum discount a customer at each tier can be given, before category limits are
              even considered.
            </p>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Max Discount %</th>
                </tr>
              </thead>
              <tbody>
                {tierLimits.map((t) => (
                  <tr key={t.tier}>
                    <td>{t.tier}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={t.maxDiscountPercentage}
                        onChange={(e) => updateTier(t.tier, e.target.value)}
                        style={{ width: 90 }}
                      />
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sales-card">
            <h2>Category Maximum Discounts</h2>
            <p className="page-subtitle">
              The maximum discount allowed on a line item, based on its product category.
            </p>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Max Discount %</th>
                </tr>
              </thead>
              <tbody>
                {categoryLimits.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={c.maxDiscountPercentage}
                        onChange={(e) => updateCategory(c.category, e.target.value)}
                        style={{ width: 90 }}
                      />
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sales-card">
            <h2>Blended Risk &amp; Approval Logic</h2>
            <p style={{ color: "#444", fontSize: "0.9rem", lineHeight: 1.6 }}>
              For every line on a quote, the effective discount ceiling is whichever is{" "}
              <strong>more restrictive</strong> of the two tables above - the customer's tier limit or
              that line's category limit. If the discount actually given exceeds a line's effective
              ceiling, that line is "over ceiling" by the difference in percentage points.
              <br />
              <br />
              The <strong>blended risk score</strong> for the whole quote is based on the worst single
              line's overage, plus how many separate lines are over ceiling at all - a quote that
              breaches several categories at once is riskier than one that only breaches a single line
              by the same margin. Any breach at all means the quote is at least <strong>MEDIUM</strong>{" "}
              risk; it becomes <strong>HIGH</strong> risk if the worst line is over ceiling by more than
              the threshold below, or if at least this many lines are breached:
            </p>
            <div className="product-search-row">
              <label>
                Points over ceiling for HIGH risk:{" "}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={overByThreshold}
                  onChange={(e) => setOverByThreshold(e.target.value)}
                  style={{ width: 90 }}
                />
              </label>
              <label>
                Minimum breached lines for HIGH risk:{" "}
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={breachCountMin}
                  onChange={(e) => setBreachCountMin(e.target.value)}
                  style={{ width: 90 }}
                />
              </label>
            </div>
            <p style={{ color: "#444", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Every quote - regardless of risk level - always goes to the Sales Manager first. HIGH risk
              additionally requires Finance's approval before the Manager's decision is final; LOW and
              MEDIUM risk skip Finance entirely. Every quote - regardless of risk level - still needs
              Admin's master approval before it is fully confirmed.
            </p>
          </div>

          <div className="sales-actions">
            <button className="sales-btn sales-btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
