import { enumerateResourceCombos } from "@/engine/handlers/combatHandler";
import type { ResourceType } from "@/lib/types";

type Stock = Record<ResourceType, number>;

function total(combo: Stock): number {
  return combo.food + combo.wood + combo.ore + combo.gold;
}

function comboKey(combo: Stock): string {
  return `${combo.food}/${combo.wood}/${combo.ore}/${combo.gold}`;
}

describe("enumerateResourceCombos", () => {
  test("single resource type gives a single option", () => {
    const combos = enumerateResourceCombos({ food: 5, wood: 0, ore: 0, gold: 0 }, 3);
    expect(combos).toEqual([{ food: 3, wood: 0, ore: 0, gold: 0 }]);
  });

  test("count equal to total stock gives a single take-everything option", () => {
    const combos = enumerateResourceCombos({ food: 1, wood: 2, ore: 0, gold: 1 }, 4);
    expect(combos).toEqual([{ food: 1, wood: 2, ore: 0, gold: 1 }]);
  });

  test("every combo has the requested size and respects stock limits", () => {
    const stock: Stock = { food: 5, wood: 1, ore: 2, gold: 3 };
    const combos = enumerateResourceCombos(stock, 4);
    for (const combo of combos) {
      expect(total(combo)).toBe(4);
      for (const type of ["food", "wood", "ore", "gold"] as ResourceType[]) {
        expect(combo[type]).toBeGreaterThanOrEqual(0);
        expect(combo[type]).toBeLessThanOrEqual(stock[type]);
      }
    }
  });

  test("contains no duplicate combos", () => {
    const combos = enumerateResourceCombos({ food: 5, wood: 5, ore: 5, gold: 5 }, 3);
    const keys = combos.map(comboKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("option count is bounded by 24 permutations even for large steals", () => {
    const combos = enumerateResourceCombos({ food: 10, wood: 10, ore: 10, gold: 10 }, 8);
    expect(combos.length).toBeLessThanOrEqual(24);
    expect(combos.length).toBeGreaterThan(0);
  });

  test("offers a pure bundle of each type when stock allows", () => {
    const combos = enumerateResourceCombos({ food: 5, wood: 5, ore: 5, gold: 5 }, 3);
    const keys = new Set(combos.map(comboKey));
    expect(keys.has("3/0/0/0")).toBe(true); // all food
    expect(keys.has("0/3/0/0")).toBe(true); // all wood
    expect(keys.has("0/0/3/0")).toBe(true); // all ore
    expect(keys.has("0/0/0/3")).toBe(true); // all gold
  });

  test("offers greedy mixed bundles when the preferred type runs out", () => {
    // Stealing 3 with only 2 gold available: gold-first ordering must spill into another type
    const combos = enumerateResourceCombos({ food: 5, wood: 0, ore: 1, gold: 2 }, 3);
    const keys = new Set(combos.map(comboKey));
    expect(keys.has("0/0/1/2")).toBe(true); // gold first, then ore
    expect(keys.has("1/0/0/2")).toBe(true); // gold first, then food
    expect(keys.has("3/0/0/0")).toBe(true); // food only
    expect(keys.has("2/0/1/0")).toBe(true); // ore first, then food
  });

  test("returns the empty bundle for count 0", () => {
    const combos = enumerateResourceCombos({ food: 2, wood: 2, ore: 0, gold: 0 }, 0);
    expect(combos).toEqual([{ food: 0, wood: 0, ore: 0, gold: 0 }]);
  });
});
