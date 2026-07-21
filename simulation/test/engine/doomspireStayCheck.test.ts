import { GameMaster } from "@/engine/GameMaster";
import { RandomPlayerAgent } from "@/players/RandomPlayerAgent";

// The Doomspire stay check: a knight camped at Doomspire must impress the dragon again
// at the end of the owner's move phase on each FOLLOWING turn - but not on the turn it
// entered (entering already triggers the encounter via tile arrival).
//
// Both tests are deterministic: the knight has 0 fame/gold/tiles (no auto-impression)
// and 0 might, so it rolls at most 6 (2D3) against the dragon's minimum 10 (might 8 + 2D3)
// and is always eaten if checked.
describe("Doomspire stay check", () => {
  function setup() {
    const gameMaster = new GameMaster({
      players: [
        new RandomPlayerAgent("A"),
        new RandomPlayerAgent("B"),
        new RandomPlayerAgent("C"),
        new RandomPlayerAgent("D"),
      ],
      startingValues: { food: 20 },
      seed: 42,
    });
    gameMaster.start();

    const gameState = gameMaster.getGameState();
    const doomspire = gameState.board.findTiles((tile) => tile.tileType === "doomspire")[0];
    doomspire.explored = true;

    const player = gameState.players[0];
    player.champions[0].position = { ...doomspire.position };

    return { gameMaster, player };
  }

  async function runStayCheck(gameMaster: GameMaster, player: any) {
    // The check runs at the end of the owner's move phase; invoke it directly for determinism
    await (gameMaster as any).handleDoomspireStayCheck(player, new RandomPlayerAgent(player.name));
  }

  test("camped knight that did nothing this turn is checked and eaten", async () => {
    const { gameMaster, player } = setup();
    player.champions[0].hasInteractedThisRound = false; // camped since a previous round

    await runStayCheck(gameMaster, player);

    expect(player.champions).toHaveLength(0); // eaten (0 might can never beat the dragon)
    const log = gameMaster.getGameLog();
    expect(log.some((entry) => entry.content.includes("staying at Doomspire"))).toBe(true);
  });

  test("knight that entered Doomspire this turn is not re-checked the same turn", async () => {
    const { gameMaster, player } = setup();
    player.champions[0].hasInteractedThisRound = true; // faced the dragon on entry this turn

    await runStayCheck(gameMaster, player);

    expect(player.champions).toHaveLength(1); // still alive - no second engagement
    const log = gameMaster.getGameLog();
    expect(log.some((entry) => entry.content.includes("staying at Doomspire"))).toBe(false);
  });
});
