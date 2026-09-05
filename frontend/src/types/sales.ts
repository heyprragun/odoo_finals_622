export type ProductCategory = "HARDWARE" | "SERVICE" | "SUBSCRIPTION";
export type CustomerTier = "GOLD" | "SILVER" | "BRONZE";
export type CustomerRequestStatus = "NEW" | "IN_REVIEW" | "QUOTED" | "CONVERTED" | "CANCELLED";
export type QuoteStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_MANAGER_APPROVAL"
  | "PENDING_FINANCE_APPROVAL"
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUIRED"
  | "CANCELLED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  description: string | null;
  unitPrice: number;
  cost?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  active: boolean;
}

export interface CustomerSummary {
  id: string;
  name: string;
  tier: CustomerTier;
}

export interface CustomerRequestListItem {
  id: string;
  customerId: string;
  customer: CustomerSummary;
  status: CustomerRequestStatus;
  notes: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRequestItemDetail {
  id: string;
  productId: string;
  requestedQuantity: number;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    category: ProductCategory;
    unitPrice: number;
  };
}

export interface LinkedQuoteSummary {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
}

export interface CustomerRequestDetail {
  id: string;
  customerId: string;
  customer: CustomerSummary;
  status: CustomerRequestStatus;
  notes: string | null;
  expectedDiscountPercentage: number | null;
  createdAt: string;
  updatedAt: string;
  quote: LinkedQuoteSummary | null;
  items: CustomerRequestItemDetail[];
}

export interface QuoteItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    sku: string;
    category: ProductCategory;
  };
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  salesRepId: string;
  customerRequestId: string | null;
  status: QuoteStatus;
  riskLevel: RiskLevel | null;
  subtotal: number;
  discountPercentage: number;
  taxPercentage: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerSummary;
  items: QuoteItem[];
}

export interface WarehouseAvailability {
  warehouseId: string;
  warehouseName: string;
  location: string;
  quantityAvailable: number;
  quantityReserved: number;
}

export interface QuoteItemInput {
  productId: string;
  quantity: number;
}

export interface StockSummaryItem {
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  warehouseCount: number;
}

export interface StockAllocationLine {
  warehouseId: string;
  warehouseName: string;
  location: string;
  quantityAllocated: number;
  quantityAvailable: number;
  // Provision for a later phase - always null until location-based shipping
  // cost estimation is wired up.
  estimatedShippingCost: number | null;
}

export interface StockAllocationResult {
  productId: string;
  requestedQuantity: number;
  totalAvailable: number;
  fulfillable: boolean;
  shortfall: number;
  allocations: StockAllocationLine[];
}

export interface ApprovalSummary {
  pending: number;
  returned: number;
  approved: number;
}

export interface ApprovalListItem {
  id: string;
  quoteNumber: string;
  customer: CustomerSummary;
  status: QuoteStatus;
  riskLevel: RiskLevel | null;
  stageLabel: string;
  assignedTo: string | null;
  totalAmount: number;
  updatedAt: string;
}

export interface ApprovalLineBreakdown {
  productId: string;
  productName: string;
  category: ProductCategory;
  discountGivenPercentage: number;
  limitAllowedPercentage: number;
  overByPoints: number;
}

export interface ApprovalWorkflow {
  stages: readonly string[];
  currentIndex: number;
  outcome: "IN_PROGRESS" | "REJECTED" | "RETURNED";
}

export interface ApprovalAuditEntry {
  id: string;
  user: string;
  action: string;
  note: string | null;
  createdAt: string;
}

export interface ApprovalDetail extends ApprovalListItem {
  customerTier: CustomerTier;
  lines: ApprovalLineBreakdown[];
  workflow: ApprovalWorkflow;
  auditTrail: ApprovalAuditEntry[];
}

export type BillingCycle = "MONTHLY" | "QUARTERLY" | "ANNUALLY";
export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED";
export type SubscriptionEventType =
  | "CREATED"
  | "PAUSED"
  | "RESUMED"
  | "CANCELLED"
  | "QUANTITY_CHANGED";

export interface SubscriptionListItem {
  id: string;
  customer: CustomerSummary;
  product: { id: string; name: string; sku: string };
  quantity: number;
  unitPrice: number;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  nextBillingDate: string;
  startDate: string;
}

export interface SubscriptionsSummary {
  active: number;
  paused: number;
  cancelled: number;
}

export interface OneTimeOrder {
  quoteId: string;
  quoteNumber: string;
  date: string;
  products: string;
  amount: number;
}

export interface RecurringOrder {
  id: string;
  subscriptionId: string;
  productName: string;
  billingCycle: BillingCycle;
  type: SubscriptionEventType;
  amount: number | null;
  note: string | null;
  createdAt: string;
}

export interface CompanySubscriptionDetail {
  customer: CustomerSummary;
  subscriptions: SubscriptionListItem[];
  oneTimeOrders: OneTimeOrder[];
  recurringOrders: RecurringOrder[];
}

export type InvoiceStatus = "UNPAID" | "PAID";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customer: CustomerSummary;
  amount: number;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
}

export interface InvoicesSummary {
  paid: number;
  unpaid: number;
}

export interface InvoiceQuoteLine {
  productName: string;
  sku: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  paidAt: string | null;
  quote: {
    id: string;
    quoteNumber: string;
    orderDate: string;
    items: InvoiceQuoteLine[];
  } | null;
  subscription: {
    id: string;
    productName: string;
    billingCycle: BillingCycle;
    quantity: number;
    status: SubscriptionStatus;
    nextBillingDate: string;
  } | null;
}

export interface CategoryDiscountLimitEntry {
  category: ProductCategory;
  maxDiscountPercentage: number;
}

export interface TierDiscountLimitEntry {
  tier: CustomerTier;
  maxDiscountPercentage: number;
}

export interface RiskEngineSettings {
  highRiskOverByThreshold: number;
  highRiskBreachCountMin: number;
}

export interface GovernanceSettings {
  categoryLimits: CategoryDiscountLimitEntry[];
  tierLimits: TierDiscountLimitEntry[];
  riskSettings: RiskEngineSettings;
}

// --- Customer portal (self-scoped views) ---

export type CustomerOrderStatus = "IN_PROGRESS" | "APPROVED" | "CANCELLED";

export interface CustomerOrderItem {
  productName: string;
  quantity: number;
}

export interface CustomerOrder {
  id: string;
  status: CustomerOrderStatus;
  quote: { id: string; quoteNumber: string } | null;
  items: CustomerOrderItem[];
  expectedDiscountPercentage: number | null;
  notes: string | null;
  createdAt: string;
  // Recommendations the Sales Rep has sent for this order's quote, still
  // awaiting the customer's accept/reject - drives the notification badge.
  pendingRecommendationCount: number;
}

export interface CustomerOrderDetailItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface CustomerOrderRecommendation {
  id: string;
  type: RecommendationType;
  reason: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    category: ProductCategory;
    unitPrice: number;
  };
}

export interface CustomerOrderDetail extends Omit<CustomerOrder, "items"> {
  cancellable: boolean;
  items: CustomerOrderDetailItem[];
  recommendations: CustomerOrderRecommendation[];
}

export interface CustomerSubscriptionItem {
  id: string;
  productName: string;
  quantity: number;
  billingCycle: BillingCycle;
  nextBillingDate: string;
}

export interface CustomerInvoiceItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  reference: string;
}

export interface CustomerInvoicesResponse {
  paid: CustomerInvoiceItem[];
  unpaid: CustomerInvoiceItem[];
}

export interface NegotiableQuoteItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface NegotiableQuote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  // NEGOTIABLE: APPROVED or REJECTED - the customer can act on it. IN_PROGRESS:
  // a negotiation was already sent and is awaiting the Sales Rep - no further
  // action until it comes back around.
  negotiationStatus: "NEGOTIABLE" | "IN_PROGRESS";
  rejectionReason: string | null;
  subtotal: number;
  discountPercentage: number;
  taxPercentage: number;
  totalAmount: number;
  items: NegotiableQuoteItem[];
  updatedAt: string;
}

export type RecommendationType = "UPSELL" | "CROSS_SELL";
export type RecommendationStatus = "SUGGESTED" | "SENT_TO_CUSTOMER" | "ACCEPTED" | "DECLINED";

export interface QuoteRecommendation {
  id: string;
  type: RecommendationType;
  status: RecommendationStatus;
  reason: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    category: ProductCategory;
    unitPrice: number;
  };
  createdAt: string;
  updatedAt: string;
}
