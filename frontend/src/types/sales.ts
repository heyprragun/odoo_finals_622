export type ProductCategory = "HARDWARE" | "SERVICE" | "SUBSCRIPTION";
export type CustomerTier = "GOLD" | "SILVER" | "BRONZE";
export type CustomerRequestStatus = "NEW" | "IN_REVIEW" | "QUOTED" | "CANCELLED";
export type QuoteStatus = "DRAFT" | "SUBMITTED";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unitPrice: number;
  cost?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface CustomerRequestDetail {
  id: string;
  customerId: string;
  customer: CustomerSummary;
  status: CustomerRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  subtotal: number;
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
