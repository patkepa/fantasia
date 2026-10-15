import { expect, it } from "vitest";
import { calculateTaxRevenue, type TaxSource } from "./tax-calculation";

it("calculates income independently of treasury, with explicit market ownership", () => {
  const source: TaxSource = {
    states: [
      { i: 0, pollTax: 1 },
      { i: 1, pollTax: 0.2, rural: 10, urban: 5 },
      { i: 2, pollTax: 1, removed: true }
    ],
    burgs: [{ state: 0 }, { state: 1 }, { state: 2 }],
    markets: [{ i: 7, centerBurgId: 1 }],
    deals: [
      { seller: 1, sellerType: "burg", tax: 1.125 },
      { seller: 7, sellerType: "market", tax: 2 },
      { seller: 0, sellerType: "burg", tax: 100 },
      { seller: 2, sellerType: "burg", tax: 100 },
      { seller: 99, sellerType: "market", tax: 100 }
    ]
  };
  const before = structuredClone(source);
  expect([...calculateTaxRevenue(source)]).toEqual([[1, { sales: 3.125, poll: 3, total: 6.13 }]]);
  expect(source).toEqual(before);
});
