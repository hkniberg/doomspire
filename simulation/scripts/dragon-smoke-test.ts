// Ad-hoc smoke test for the Doomspire / dragon flow. Run with:
//   ./node_modules/.bin/tsx scripts/dragon-smoke-test.ts
import { GameState } from "../src/game/GameState";
import { handleExploration } from "../src/engine/handlers/tileArrivalHandler";
import { resolveChampionVsDragonEncounter } from "../src/engine/handlers/combatHandler";
import { RandomPlayerAgent } from "../src/players/RandomPlayerAgent";

async function main() {
  const gameState = GameState.createWithPlayerNames(["Alice", "Bob", "Charlie", "Diana"], undefined, 5);
  const logFn = (type: string, content: string) => console.log(`[${type}] ${content}`);
  const agent = new RandomPlayerAgent("Alice");

  const doomspireTile = gameState.board.findTiles((t) => t.tileType === "doomspire")[0];
  const alice = gameState.getPlayer("Alice")!;
  alice.fame = 20;
  alice.champions[0].position = doomspireTile.position;

  // Explore doomspire -> hoard created
  handleExploration(gameState, doomspireTile, alice, logFn);
  console.assert(doomspireTile.treasureStacks?.length === 3, "FAIL: expected 3 treasure stacks");

  // First impression: 17+ fame
  let result = await resolveChampionVsDragonEncounter(gameState, doomspireTile, alice, 1, logFn, agent, []);
  console.assert(result.impressed === true && result.gameWon === false, "FAIL: expected impression without win");
  console.assert(alice.dragonImpressions === 1, "FAIL: expected 1 impression");
  console.assert(doomspireTile.treasureStacks?.length === 2, "FAIL: expected 2 stacks after reward");
  console.assert(alice.champions[0].position.row === doomspireTile.position.row, "FAIL: knight should stay at Doomspire");

  // Same round: dragon dozes off
  result = await resolveChampionVsDragonEncounter(gameState, doomspireTile, alice, 1, logFn, agent, []);
  console.assert(result.impressed !== true, "FAIL: should not impress twice in one round");

  // Next round: second impression wins the game
  gameState.resetRoundState();
  result = await resolveChampionVsDragonEncounter(gameState, doomspireTile, alice, 1, logFn, agent, []);
  console.assert(result.impressed === true && result.gameWon === true, "FAIL: expected game won on 2nd impression");

  // Bob with no fame/gold/tiles must fight and (with 0 might) will likely be eaten. Force loss by might 0 vs dragon 8.
  const bob = gameState.getPlayer("Bob")!;
  bob.champions[0].position = doomspireTile.position;
  gameState.resetRoundState();
  const bobAgent = new RandomPlayerAgent("Bob");
  result = await resolveChampionVsDragonEncounter(gameState, doomspireTile, bob, 1, logFn, bobAgent, []);
  console.assert(result.championEaten === true || result.impressed === true, "FAIL: expected combat resolution");
  if (result.championEaten) {
    console.assert(bob.champions.length === 0, "FAIL: eaten champion should be removed");
  }

  console.log("Dragon smoke test completed.");

  // === End-to-end: a knight parked at Doomspire with 17+ fame should win within 2 rounds ===
  const { GameMaster } = await import("../src/engine/GameMaster");
  const gm = new GameMaster({
    players: [
      new RandomPlayerAgent("Alice"),
      new RandomPlayerAgent("Bob"),
      new RandomPlayerAgent("Charlie"),
      new RandomPlayerAgent("Diana"),
    ],
    maxRounds: 10,
    seed: 5,
  });
  gm.start();
  const state = gm.getGameState();
  const doomspire = state.board.findTiles((t) => t.tileType === "doomspire")[0];
  doomspire.explored = true;
  const alice2 = state.getPlayer("Alice")!;
  alice2.fame = 20;
  alice2.champions[0].position = doomspire.position;

  let turns = 0;
  while (gm.getMasterState() === "playing" && turns < 20) {
    await gm.executeTurn();
    turns++;
  }

  console.assert(gm.getMasterState() === "finished", "FAIL: expected the game to finish");
  console.assert(state.getPlayer("Alice")!.finalRank === "King of Doomspire", "FAIL: expected Alice to be King");
  console.log(`End-to-end victory test completed after ${turns} turns. Alice rank: ${state.getPlayer("Alice")!.finalRank}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
