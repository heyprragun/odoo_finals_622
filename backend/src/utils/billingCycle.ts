import { BillingCycle } from "@prisma/client";

export function addBillingCycleInterval(date: Date, cycle: BillingCycle): Date {
  const next = new Date(date);
  switch (cycle) {
    case BillingCycle.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      next.setMonth(next.getMonth() + 3);
      break;
    case BillingCycle.ANNUALLY:
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// Simplified (not calendar-precise) cycle lengths, used only for prorating a
// mid-cycle quantity change.
export function cycleLengthInDays(cycle: BillingCycle): number {
  switch (cycle) {
    case BillingCycle.MONTHLY:
      return 30;
    case BillingCycle.QUARTERLY:
      return 90;
    case BillingCycle.ANNUALLY:
      return 365;
  }
}
