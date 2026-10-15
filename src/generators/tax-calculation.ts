import type { PackedGraph } from "@/types/PackedGraph";
import { rn } from "@/utils/numberUtils";

export interface TaxSource {
  states: readonly Pick<PackedGraph["states"][number], "i" | "removed" | "rural" | "urban" | "pollTax">[];
  burgs: readonly Pick<PackedGraph["burgs"][number], "state">[];
  markets: readonly Pick<PackedGraph["markets"][number], "i" | "centerBurgId">[];
  deals: readonly Pick<PackedGraph["deals"][number], "seller" | "sellerType" | "tax">[];
}

export interface TaxRevenue {
  sales: number;
  poll: number;
  total: number;
}

/** Frozen-cycle map taxes, not a recurring treasury update. All inputs remain unchanged. */
export function calculateTaxRevenue({ states, burgs, markets, deals }: TaxSource): Map<number, TaxRevenue> {
  const revenue = new Map<number, TaxRevenue>();
  for (const state of states) {
    if (!state?.i || state.removed) continue;
    revenue.set(state.i, { sales: 0, poll: state.pollTax * ((state.rural || 0) + (state.urban || 0)), total: 0 });
  }
  const marketCenters = new Map(markets.map(market => [market.i, market.centerBurgId]));
  for (const deal of deals) {
    if (!deal.tax) continue;
    const burgId = deal.sellerType === "burg" ? deal.seller : marketCenters.get(deal.seller);
    const stateId = burgId ? burgs[burgId]?.state : 0;
    const entry = stateId ? revenue.get(stateId) : undefined;
    if (entry) entry.sales += deal.tax;
  }
  for (const entry of revenue.values()) entry.total = rn(entry.sales + entry.poll, 2);
  return revenue;
}
