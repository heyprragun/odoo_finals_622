import {
  PrismaClient,
  Prisma,
  ProductCategory,
  CustomerTier,
  Role,
  BillingCycle,
  SubscriptionStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { addBillingCycleInterval } from "../src/utils/billingCycle";
import { createInvoicesForApprovedQuote } from "../src/services/invoice.service";

const prisma = new PrismaClient();

// Shared demo password for every demo user. Hackathon-only; never use this
// pattern for real credentials.
const DEMO_PASSWORD = "Demo@1234";

const CUSTOMERS = [
  { name: "ABC Corporation", tier: CustomerTier.GOLD },
  { name: "TechNova", tier: CustomerTier.SILVER },
  { name: "StartupHub", tier: CustomerTier.BRONZE },
] as const;

const PRODUCTS = [
  { name: "Business Laptop", sku: "HW-LAPTOP-001", category: ProductCategory.HARDWARE, unitPrice: 85000, cost: 60000 },
  { name: "4K Monitor", sku: "HW-MONITOR-001", category: ProductCategory.HARDWARE, unitPrice: 35000, cost: 22000 },
  { name: "Wireless Dock", sku: "HW-DOCK-001", category: ProductCategory.HARDWARE, unitPrice: 15000, cost: 9000 },
  { name: "Installation Service", sku: "SVC-INSTALL-001", category: ProductCategory.SERVICE, unitPrice: 12000, cost: 5000 },
  { name: "Cloud Pro", sku: "SUB-CLOUDPRO-001", category: ProductCategory.SUBSCRIPTION, unitPrice: 3000, cost: 1000 },
  { name: "Premium Support", sku: "SVC-SUPPORT-001", category: ProductCategory.SERVICE, unitPrice: 18000, cost: 7000 },
] as const;

const USERS = [
  { email: "admin@dealflow.demo", name: "Demo Admin", role: Role.ADMIN },
  { email: "sales@dealflow.demo", name: "Demo Sales Rep", role: Role.SALES_REP },
  { email: "manager@dealflow.demo", name: "Demo Manager", role: Role.MANAGER },
  { email: "finance@dealflow.demo", name: "Demo Finance", role: Role.FINANCE },
  {
    email: "customer@dealflow.demo",
    name: "Demo Customer",
    role: Role.CUSTOMER,
    customerName: "ABC Corporation",
  },
] as const;

const WAREHOUSES = [
  { name: "Delhi Warehouse", location: "Delhi" },
  { name: "Mumbai Warehouse", location: "Mumbai" },
  { name: "Bangalore Warehouse", location: "Bangalore" },
] as const;

const INVENTORY_BY_SKU: Record<string, Record<string, number>> = {
  "HW-LAPTOP-001": { "Delhi Warehouse": 25, "Mumbai Warehouse": 12, "Bangalore Warehouse": 8 },
  "HW-MONITOR-001": { "Delhi Warehouse": 20, "Mumbai Warehouse": 15, "Bangalore Warehouse": 10 },
  "HW-DOCK-001": { "Delhi Warehouse": 30, "Mumbai Warehouse": 20, "Bangalore Warehouse": 15 },
  "SVC-INSTALL-001": { "Delhi Warehouse": 100, "Mumbai Warehouse": 100, "Bangalore Warehouse": 100 },
  "SUB-CLOUDPRO-001": { "Delhi Warehouse": 100, "Mumbai Warehouse": 100, "Bangalore Warehouse": 100 },
  "SVC-SUPPORT-001": { "Delhi Warehouse": 50, "Mumbai Warehouse": 50, "Bangalore Warehouse": 50 },
};

// Default discount ceilings used by the approval risk engine. Admin-editable
// in a future phase; for now these are the seeded defaults.
const CATEGORY_DISCOUNT_LIMITS: Record<ProductCategory, number> = {
  [ProductCategory.HARDWARE]: 15,
  [ProductCategory.SERVICE]: 10,
  [ProductCategory.SUBSCRIPTION]: 20,
};

const CUSTOMER_REQUESTS = [
  {
    customerName: "ABC Corporation",
    items: [
      { sku: "HW-LAPTOP-001", quantity: 5 },
      { sku: "HW-MONITOR-001", quantity: 5 },
      { sku: "SVC-INSTALL-001", quantity: 2 },
    ],
  },
  {
    customerName: "TechNova",
    items: [
      { sku: "HW-DOCK-001", quantity: 10 },
      { sku: "HW-LAPTOP-001", quantity: 10 },
      { sku: "SVC-SUPPORT-001", quantity: 1 },
    ],
  },
] as const;

// Illustrative subscriptions covering all three statuses/cycles so the
// Subscriptions page has real, varied data from the first run. Not linked to
// a quote (quoteId stays null) - real ones are auto-created when a quote
// with a SUBSCRIPTION-category line is approved.
const SUBSCRIPTION_SEEDS = [
  {
    customerName: "ABC Corporation",
    sku: "SUB-CLOUDPRO-001",
    quantity: 5,
    billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
  },
  {
    customerName: "TechNova",
    sku: "SUB-CLOUDPRO-001",
    quantity: 3,
    billingCycle: BillingCycle.QUARTERLY,
    status: SubscriptionStatus.PAUSED,
  },
  {
    customerName: "StartupHub",
    sku: "SUB-CLOUDPRO-001",
    quantity: 10,
    billingCycle: BillingCycle.ANNUALLY,
    status: SubscriptionStatus.CANCELLED,
  },
] as const;

// Customer.name and Warehouse.name have no DB-level unique constraint, so
// idempotency here is done via lookup-then-create/update rather than upsert.
async function upsertCustomerByName(name: string, tier: CustomerTier) {
  const existing = await prisma.customer.findFirst({ where: { name } });
  if (existing) {
    return prisma.customer.update({ where: { id: existing.id }, data: { tier } });
  }
  return prisma.customer.create({ data: { name, tier } });
}

async function upsertWarehouseByName(name: string, location: string) {
  const existing = await prisma.warehouse.findFirst({ where: { name } });
  if (existing) {
    return prisma.warehouse.update({ where: { id: existing.id }, data: { location, active: true } });
  }
  return prisma.warehouse.create({ data: { name, location, active: true } });
}

async function main() {
  console.log("Seeding customers...");
  const customersByName = new Map<string, { id: string }>();
  for (const c of CUSTOMERS) {
    const customer = await upsertCustomerByName(c.name, c.tier);
    customersByName.set(c.name, customer);
  }

  console.log("Seeding products...");
  const productsBySku = new Map<string, { id: string; unitPrice: Prisma.Decimal }>();
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        category: p.category,
        unitPrice: p.unitPrice,
        cost: p.cost,
        active: true,
      },
      create: {
        name: p.name,
        sku: p.sku,
        category: p.category,
        unitPrice: p.unitPrice,
        cost: p.cost,
      },
    });
    productsBySku.set(p.sku, product);
  }

  console.log("Seeding demo users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of USERS) {
    const customerId =
      "customerName" in u ? customersByName.get(u.customerName)?.id : undefined;
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, customerId },
      create: { email: u.email, name: u.name, role: u.role, passwordHash, customerId },
    });
  }

  console.log("Seeding category discount limits...");
  for (const [category, maxDiscountPercentage] of Object.entries(CATEGORY_DISCOUNT_LIMITS)) {
    await prisma.categoryDiscountLimit.upsert({
      where: { category: category as ProductCategory },
      update: { maxDiscountPercentage },
      create: { category: category as ProductCategory, maxDiscountPercentage },
    });
  }

  console.log("Seeding warehouses...");
  const warehousesByName = new Map<string, { id: string }>();
  for (const w of WAREHOUSES) {
    const warehouse = await upsertWarehouseByName(w.name, w.location);
    warehousesByName.set(w.name, warehouse);
  }

  console.log("Seeding inventory...");
  for (const [sku, byWarehouse] of Object.entries(INVENTORY_BY_SKU)) {
    const product = productsBySku.get(sku);
    if (!product) continue;
    for (const [warehouseName, quantityAvailable] of Object.entries(byWarehouse)) {
      const warehouse = warehousesByName.get(warehouseName);
      if (!warehouse) continue;
      await prisma.inventory.upsert({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
        update: { quantityAvailable },
        create: { warehouseId: warehouse.id, productId: product.id, quantityAvailable },
      });
    }
  }

  console.log("Seeding customer requests...");
  for (const req of CUSTOMER_REQUESTS) {
    const customer = customersByName.get(req.customerName);
    if (!customer) continue;

    const existingRequest = await prisma.customerRequest.findFirst({
      where: { customerId: customer.id },
    });
    if (existingRequest) {
      console.log(`  - ${req.customerName} already has a customer request, skipping`);
      continue;
    }

    await prisma.customerRequest.create({
      data: {
        customerId: customer.id,
        status: "NEW",
        items: {
          create: req.items.map((item) => {
            const product = productsBySku.get(item.sku);
            if (!product) throw new Error(`Unknown seed product sku: ${item.sku}`);
            return { productId: product.id, requestedQuantity: item.quantity };
          }),
        },
      },
    });
  }

  console.log("Seeding demo subscriptions...");
  for (const sub of SUBSCRIPTION_SEEDS) {
    const customer = customersByName.get(sub.customerName);
    const product = productsBySku.get(sub.sku);
    if (!customer || !product) continue;

    const existing = await prisma.subscription.findFirst({
      where: { customerId: customer.id, productId: product.id, quoteId: null },
    });
    if (existing) {
      console.log(`  - ${sub.customerName} already has a seeded subscription, skipping`);
      continue;
    }

    const startDate = new Date();
    const nextBillingDate = addBillingCycleInterval(startDate, sub.billingCycle);

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        productId: product.id,
        quantity: sub.quantity,
        unitPrice: product.unitPrice,
        billingCycle: sub.billingCycle,
        status: sub.status,
        startDate,
        nextBillingDate,
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: "CREATED",
        amount: product.unitPrice.mul(sub.quantity),
        note: "Seed subscription for demo purposes",
      },
    });

    if (sub.status === SubscriptionStatus.PAUSED) {
      await prisma.subscriptionEvent.create({
        data: { subscriptionId: subscription.id, type: "PAUSED", note: "Paused for seed demo" },
      });
    }
    if (sub.status === SubscriptionStatus.CANCELLED) {
      await prisma.subscriptionEvent.create({
        data: { subscriptionId: subscription.id, type: "CANCELLED", note: "Cancelled for seed demo" },
      });
    }
    // Invoice for this standalone (no quoteId) subscription is created in
    // the dedicated backfill pass below, which runs regardless of whether
    // the subscription was just created here or already existed.
  }

  console.log("Seeding a draft quote for sales@dealflow.demo...");
  const salesRep = await prisma.user.findUnique({ where: { email: "sales@dealflow.demo" } });
  const abcCorp = customersByName.get("ABC Corporation");
  if (salesRep && abcCorp) {
    const existingQuote = await prisma.quote.findFirst({ where: { salesRepId: salesRep.id } });
    if (existingQuote) {
      console.log("  - sales@dealflow.demo already has a quote, skipping");
    } else {
      const dock = productsBySku.get("HW-DOCK-001")!;
      const support = productsBySku.get("SVC-SUPPORT-001")!;
      const lineItems = [
        { productId: dock.id, quantity: 2, unitPrice: dock.unitPrice },
        { productId: support.id, quantity: 1, unitPrice: support.unitPrice },
      ];
      const subtotal = lineItems.reduce(
        (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
        new Prisma.Decimal(0)
      );
      const quoteCount = await prisma.quote.count();

      await prisma.quote.create({
        data: {
          quoteNumber: `QT-${String(quoteCount + 1).padStart(5, "0")}`,
          customerId: abcCorp.id,
          salesRepId: salesRep.id,
          status: "DRAFT",
          subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal,
          notes: "Seed draft quote for demo purposes",
          items: {
            create: lineItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.unitPrice.mul(item.quantity),
            })),
          },
        },
      });
    }
  }

  console.log("Backfilling invoices for standalone seed subscriptions...");
  const standaloneSubs = await prisma.subscription.findMany({
    where: { quoteId: null },
    include: { product: true },
  });
  for (const sub of standaloneSubs) {
    const existingInvoice = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id } });
    if (existingInvoice) continue;
    const invoiceCount = await prisma.invoice.count();
    const isPaidDemo = sub.status !== SubscriptionStatus.CANCELLED;
    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(invoiceCount + 1).padStart(5, "0")}`,
        customerId: sub.customerId,
        subscriptionId: sub.id,
        amount: sub.product.unitPrice.mul(sub.quantity),
        dueDate: sub.nextBillingDate,
        status: isPaidDemo ? "PAID" : "UNPAID",
        paidAt: isPaidDemo ? sub.startDate : null,
      },
    });
  }

  console.log("Backfilling invoices for already-approved quotes...");
  const approvedQuotes = await prisma.quote.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });
  for (const q of approvedQuotes) {
    // Idempotent internally (checks for an existing invoice per quote/
    // subscription before creating) - safe to call for quotes that already
    // have invoices from a prior seed run or from real usage.
    await createInvoicesForApprovedQuote(prisma, q.id);
  }

  console.log("Seed complete.");
  console.log(`Demo login password for all demo users: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
