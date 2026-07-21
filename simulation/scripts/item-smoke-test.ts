// Ad-hoc smoke test for special treasure items. Run with:
//   ./node_modules/.bin/tsx scripts/item-smoke-test.ts
import { getTreasureCardById } from "../src/content/treasureCards";
import { resolveChampionVsMonsterCombat } from "../src/engine/handlers/combatHandler";
import { handleTreasureCard } from "../src/engine/handlers/treasureCardHandler";
import { GameState } from "../src/game/GameState";
import { Monster } from "../src/lib/types";
import { canChampionCarryMoreItems, getChampionUsedItemSlots } from "../src/players/PlayerUtils";
import { RandomPlayerAgent } from "../src/players/RandomPlayerAgent";

async function main() {
  const gameState = GameState.createWithPlayerNames(["Alice", "Bob", "Charlie", "Diana"], undefined, 5);
  const logFn = (type: string, content: string) => console.log(`[${type}] ${content}`);
  const agent = new RandomPlayerAgent("Alice");
  const alice = gameState.getPlayer("Alice")!;
  const champion = alice.champions[0];
  const tile = gameState.getTile(champion.position)!;

  // The second ring: +2 fame on acquisition
  const fameBefore = alice.fame;
  await handleTreasureCard("the-second-ring", gameState, tile, alice, agent, 1, [], logFn);
  console.assert(alice.fame === fameBefore + 2, "FAIL: expected +2 fame from second ring");
  console.assert(champion.items.some(i => i.treasureCard?.id === "the-second-ring"), "FAIL: expected ring in inventory");

  // Löng Swörd: takes up 2 slots (1 ring + 2 sword slots = 3 > capacity 2, so it cannot be picked up directly)
  console.assert(getChampionUsedItemSlots(champion) === 1, "FAIL: expected 1 used slot");
  console.assert(!canChampionCarryMoreItems(champion, 2), "FAIL: long sword should not fit next to the ring");

  // The one ring: +2 might in combat. Fight a might-3 monster with 0 might: 1D3 + 2 >= 3 always wins.
  champion.items.push({ treasureCard: getTreasureCardById("the-one-ring") });
  const weakMonster: Monster = {
    id: "test-wolf", name: "Test Wolf", tier: 1, icon: "", might: 3, fame: 0,
    resources: { food: 0, wood: 0, ore: 0, gold: 0 }, monsterType: "beast",
  };
  tile.monster = weakMonster;
  const combatResult = await resolveChampionVsMonsterCombat(gameState, tile, alice, 1, logFn);
  console.assert(combatResult.victory === true, "FAIL: expected guaranteed win with one ring (+2 might)");

  // Staff of protection: diagonal protection
  const bob = gameState.getPlayer("Bob")!;
  const claimTile = gameState.getTile({ row: 1, col: 1 })!;
  claimTile.tileType = "resource";
  claimTile.claimedBy = "Alice";
  champion.position = { row: 0, col: 0 }; // diagonal to (1,1)
  console.assert(!gameState.isClaimProtected(claimTile), "FAIL: diagonal knight without staff should NOT protect");
  champion.items.push({ treasureCard: getTreasureCardById("staff-of-protection") });
  console.assert(gameState.isClaimProtected(claimTile), "FAIL: diagonal knight WITH staff should protect");

  // Black blade: fight ghostly knight (give Alice huge might to guarantee the win), then check the blade
  alice.might = 20;
  const blackBladeTile = gameState.getTile({ row: 0, col: 1 })!;
  champion.items = []; // Make space
  await handleTreasureCard("the-black-blade", gameState, blackBladeTile, alice, agent, 1, [], logFn);
  console.assert(champion.items.some(i => i.treasureCard?.id === "the-black-blade"), "FAIL: expected black blade in inventory");

  console.log("Item smoke test completed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
