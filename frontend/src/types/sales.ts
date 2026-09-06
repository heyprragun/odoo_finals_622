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

export interface OrderComment {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
}

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

export interface WarehouseStockItem {
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  quantityAvailable: number;
  quantityReserved: number;
}

export interface WarehouseDetail {
  id: string;
  name: string;
  location: string;
  summary: { productsStocked: number; totalUnitsAvailable: number };
  items: WarehouseStockItem[];
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
  shippingLocation: string | null;
  createdAt: string;
  updatedAt: string;
  quote: LinkedQuoteSummary | null;
  // Present only for a "Change Subscription Plan" request - the existing
  // subscription this request's approval will replace.
  modifiesSubscription: { id: string; productName: string; quantity: number; currentBillingCycle: BillingCycle } | null;
  items: CustomerRequestItemDetail[];
}

export interface QuoteItemAllocationView {
  warehouseId: string;
  warehouseName: string;
  location: string;
  quantity: number;
  // Set when this exact split came from the Groq-assisted cost-optimized
  // suggestion (see inventory.service.ts) - null for a Rep's own manual
  // choice, or when no shipping location/cost estimate was available.
  estimatedShippingCost: number | null;
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
    // Present only when the viewer is ADMIN (see sanitizeQuote.ts /
    // sanitizeProduct.ts's rule) - undefined for every other role,
    // including the owning Sales Rep.
    cost?: number;
  };
  allocations: QuoteItemAllocationView[];
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
  shippingLocation: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerSummary;
  items: QuoteItem[];
  // Present only when this quote came from a CustomerRequest with an
  // expected discount. status "PENDING" means the Rep's last submit
  // attempt offered less than expected and is blocked until the customer
  // resolves it (portal's Negotiations tab).
  customerRequestDiscountReview: {
    expectedDiscountPercentage: number | null;
    proposedDiscountPercentage: number | null;
    status: "NONE" | "PENDING";
  } | null;
  // Deal Health's "Nudge Sales Rep" reminder, if any and still "unread"
  // (newer than this quote's own updatedAt - see sanitizeQuote.ts).
  pendingNudge: { note: string | null; fromUserName: string; createdAt: string } | null;
}

export interface WarehouseAvailability {
  warehouseId: string;
  warehouseName: string;
  location: string;
  quantityAvailable: number;
  quantityReserved: number;
}

export interface QuoteItemAllocationInput {
  warehouseId: string;
  quantity: number;
}

export interface QuoteItemInput {
  productId: string;
  quantity: number;
  // Omit (or send an empty array) to fall back to the auto-suggested split.
  allocations?: QuoteItemAllocationInput[];
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
  // Groq's estimated per-unit shipping cost (INR) from this warehouse to
  // the destination - null when no destination was supplied, or the
  // estimate call failed/degraded.
  estimatedCostPerUnit: number | null;
  // estimatedCostPerUnit * quantityAllocated - what this warehouse's share
  // of the split would cost. Null under the same conditions as
  // estimatedCostPerUnit, or when nothing is allocated here.
  estimatedShippingCost: number | null;
}

export interface StockAllocationResult {
  productId: string;
  requestedQuantity: number;
  totalAvailable: number;
  fulfillable: boolean;
  shortfall: number;
  // True only when a destination was given AND Groq actually produced a
  // full set of per-warehouse estimates that drove this split.
  costOptimized: boolean;
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

export type InvoiceStatus = "UNPAID" | "PAID" | "CANCELLED";

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
  // Prefill hint only, sourced from a linked CUSTOMER-role User's login
  // email if one exists - a Customer company has no email of its own, and
  // may have none, one, or several linked logins. Always editable before
  // sending; never treated as an authoritative billing contact.
  customerEmail: string | null;
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
  shippingLocation: string | null;
  // Only ever set when a Manager/Admin cancelled an already-approved order
  // from Deal Health - unprompted news to the customer, so it comes with a
  // reason. Null for a customer-initiated cancellation (they already know
  // why) or any non-cancelled order.
  cancellationReason: string | null;
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
  unitPrice: number;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  nextBillingDate: string;
}

export interface CustomerSubscriptionEvent {
  id: string;
  type: SubscriptionEventType;
  amount: number | null;
  note: string | null;
  createdAt: string;
}

export interface CustomerSubscriptionDetail {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startDate: string;
  nextBillingDate: string;
  cancellable: boolean;
  // False while a plan-change request against this subscription is already
  // in flight - a second one would be meaningless (see
  // customerPortal.service.ts's hasPendingPlanChange).
  modifiable: boolean;
  pendingPlanChange: boolean;
  events: CustomerSubscriptionEvent[];
}

// --- Plan tier (Gold/Silver/Bronze) upgrade/downgrade requests ---

export type CustomerTierChangeType = "UPGRADE" | "DOWNGRADE";
export type CustomerTierChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyTierChangeRequest {
  id: string;
  requestedTier: CustomerTier;
  type: CustomerTierChangeType;
  status: CustomerTierChangeStatus;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface MyTierChangeInfo {
  currentTier: CustomerTier;
  requests: MyTierChangeRequest[];
}

export interface PendingTierChangeRequest {
  id: string;
  requestedTier: CustomerTier;
  type: CustomerTierChangeType;
  status: CustomerTierChangeStatus;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  customer: { id: string; name: string; currentTier: CustomerTier };
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

// An order where the Sales Rep's offered discount fell short of what the
// customer asked for - blocks submission to Manager/Finance approval until
// resolved here.
export interface DiscountReview {
  id: string;
  items: { productName: string; quantity: number }[];
  expectedDiscountPercentage: number | null;
  proposedDiscountPercentage: number | null;
  createdAt: string;
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
    // Present only when the viewer is ADMIN (see sanitizeProduct.ts's rule,
    // mirrored here) - undefined for every other role, including the
    // owning Sales Rep.
    cost?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// --- Admin Reports section ---

export interface TeamMemberPerformance {
  id: string;
  name: string;
  email: string;
  role: "SALES_REP" | "MANAGER" | "FINANCE";
  ownedQuotesTotal: number;
  ownedQuotesApproved: number;
  ownedQuotesRejected: number;
  ownedQuotesPending: number;
  approvalsGiven: number;
  returnsGiven: number;
  rejectionsGiven: number;
}

export type QuotationBucket =
  | "PENDING_MANAGER"
  | "PENDING_FINANCE"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "DRAFT_OR_REVISION";

export interface QuotationOverviewItem {
  id: string;
  quoteNumber: string;
  customerName: string;
  salesRepName: string;
  status: QuoteStatus;
  bucket: QuotationBucket;
  totalAmount: number;
  itemSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationsOverviewResponse {
  summary: {
    pendingManager: number;
    pendingFinance: number;
    pendingAdmin: number;
    approved: number;
    rejected: number;
    cancelled: number;
    draftOrRevision: number;
  };
  items: QuotationOverviewItem[];
  underReview: QuotationOverviewItem[];
  toBeShipped: QuotationOverviewItem[];
}

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unitsSold: number;
  revenue: number;
  averageDiscountPercentage: number;
}

export interface ProductPerformanceResponse {
  all: ProductPerformanceRow[];
  bestSelling: ProductPerformanceRow[];
  leastSelling: ProductPerformanceRow[];
  mostDiscounted: ProductPerformanceRow[];
}

export interface CustomerTierRow {
  id: string;
  name: string;
  tier: CustomerTier;
  totalOrders: number;
  totalApprovedSpend: number;
  activeSubscriptions: number;
}

export interface CustomerReportDetail {
  customer: CustomerSummary;
  subscriptions: SubscriptionListItem[];
  oneTimeOrders: OneTimeOrder[];
  recurringOrders: RecurringOrder[];
  invoices: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: InvoiceStatus;
    issuedDate: string;
    dueDate: string;
    paidAt: string | null;
  }[];
  previousOrders: {
    id: string;
    status: CustomerRequestStatus;
    createdAt: string;
    items: { productName: string; quantity: number }[];
    quote: { id: string; quoteNumber: string; status: QuoteStatus } | null;
  }[];
  tierChangeRequests: {
    id: string;
    requestedTier: CustomerTier;
    type: CustomerTierChangeType;
    status: CustomerTierChangeStatus;
    customerNote: string | null;
    adminNote: string | null;
    createdAt: string;
    decidedAt: string | null;
  }[];
}

export interface SalesInsight {
  productName: string;
  suggestion: string;
  suggestedDiscountPercentage: number | null;
}

export interface SalesInsightsResult {
  bestSellerInsights: SalesInsight[];
  worstSellerInsights: SalesInsight[];
}

export type DealHealthFlagType = "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE";

export interface DealHealthFlagRow {
  id: string;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerTier: CustomerTier;
  salesRepName: string;
  status: QuoteStatus;
  totalAmount: number;
  flagType: DealHealthFlagType;
  issue: string;
  flaggedAt: string;
}

export interface DealHealthOverview {
  summary: {
    stalled: number;
    discountAnomaly: number;
    deliverySlippage: number;
  };
  flags: DealHealthFlagRow[];
}

export interface DealHealthStalledFlag {
  flagType: "STALLED";
  daysSinceActivity: number;
  thresholdDays: number;
  lastActivityAt: string;
  lastAuditEntry: { action: string; user: string; note: string | null; createdAt: string } | null;
}

export interface DealHealthDiscountAnomalyFlag {
  flagType: "DISCOUNT_ANOMALY";
  discountPercentage: number;
  repAverageDiscountPercentage: number;
  overByPoints: number;
  thresholdPoints: number;
  repHistoryCount: number;
}

export interface DealHealthDeliverySlippageFlag {
  flagType: "DELIVERY_SLIPPAGE";
  daysSinceApproval: number;
  thresholdDays: number;
  shortItems: { productName: string; orderedQuantity: number; allocatedQuantity: number; shortBy: number }[];
}

export type DealHealthFlagDetail =
  | DealHealthStalledFlag
  | DealHealthDiscountAnomalyFlag
  | DealHealthDeliverySlippageFlag;

export interface DealHealthDetail {
  quote: {
    id: string;
    quoteNumber: string;
    status: QuoteStatus;
    totalAmount: number;
    discountPercentage: number;
    customer: { id: string; name: string; tier: CustomerTier };
    salesRep: { id: string; name: string };
    createdAt: string;
    updatedAt: string;
  };
  flags: DealHealthFlagDetail[];
}

export interface InternalNavAlerts {
  approvals: boolean;
  dealHealth: boolean;
  auditTrail: boolean;
  subscriptions: boolean;
  stockConflicts: boolean;
  grievances: boolean;
}

export type GrievanceStatus = "OPEN" | "RESOLVED";

export interface GrievanceMessage {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
}

export interface GrievanceDetail {
  id: string;
  status: GrievanceStatus;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  quote: { id: string; quoteNumber: string; totalAmount: number };
  customer: { id: string; name: string; tier: CustomerTier };
  messages: GrievanceMessage[];
}

export interface GrievanceSummary {
  id: string;
  status: GrievanceStatus;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  quote: { id: string; quoteNumber: string };
  customer: { id: string; name: string; tier: CustomerTier };
  messageCount: number;
}

export interface DeliveredOrder {
  quoteId: string;
  quoteNumber: string;
  totalAmount: number;
  approvedAt: string;
  items: { productName: string; quantity: number }[];
  grievance: { id: string; status: GrievanceStatus } | null;
}

export type StockPriorityConflictStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export interface StockPriorityConflict {
  id: string;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string; location: string };
  quantityNeeded: number;
  requestingCustomerName: string;
  requestingTier: CustomerTier;
  requestingMarginPercentage: number | null;
  blockingQuote: { id: string; quoteNumber: string; status: QuoteStatus; customerName: string };
  blockingQuantity: number;
  blockingTier: CustomerTier;
  blockingMarginPercentage: number | null;
  status: StockPriorityConflictStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CustomerNavAlerts {
  negotiations: boolean;
  subscriptions: boolean;
  upgradeSubscription: boolean;
}
