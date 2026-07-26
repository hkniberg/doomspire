import { calculateChampionMove } from "@/engine/actions/moveCalculator";
import { GameMaster } from "@/engine/GameMaster";
import { RandomPlayerAgent } from "@/players/RandomPlayerAgent";
import type { Position } from "@/lib/types";

// Knights stop when entering an unexplored tile, a tile with a monster, or Doomspire.
// Everything else - including adventure and oasis tiles that still hold tokens - can be
// passed through, and only the tile a knight ends on is interacted with.
describe("Champion movement stopping rules", () => {
  function setup() {
    const gameMaster = new GameMaster({
      players: [
        new RandomPlayerAgent("A"),
        new RandomPlayerAgent("B"),
        new RandomPlayerAgent("C"),
        new RandomPlayerAgent("D"),
      ],
      seed: 42,
    });
    gameMaster.start();

    const gameState = gameMaster.getGameState();
    gameState.board.forEachTile((tile) => {
      tile.explored = true;
      tile.monster = undefined;
    });

    return gameState;
  }

  test("a knight must stop when entering a revealed Doomspire", () => {
    const gameState = setup();
    const doomspire = gameState.board.findTiles((tile) => tile.tileType === "doomspire")[0].position;

    // Enter Doomspire from one side and try to continue straight out the other
    const path: Position[] = [
      { row: doomspire.row, col: doomspire.col - 1 },
      doomspire,
      { row: doomspire.row, col: doomspire.col + 1 },
    ];

    const result = calculateChampionMove(gameState, "A", path, 3);

    expect(result.stopReason).toBe("doomspireTile");
    expect(result.endPosition).toEqual(doomspire);
  });

  test("a knight may pass through an adventure tile that still has tokens", () => {
    const gameState = setup();

    // Find an adventure tile with a free tile on either side along a row
    const adventure = gameState.board.findTiles((tile) => {
      if (tile.tileType !== "adventure" || (tile.adventureTokens ?? 0) === 0) return false;
      const left = gameState.board.getTileAt({ row: tile.position.row, col: tile.position.col - 1 });
      const right = gameState.board.getTileAt({ row: tile.position.row, col: tile.position.col + 1 });
      return !!left && !!right && left.tileType !== "home" && right.tileType !== "home";
    })[0];
    expect(adventure).toBeDefined();

    const path: Position[] = [
      { row: adventure.position.row, col: adventure.position.col - 1 },
      adventure.position,
      { row: adventure.position.row, col: adventure.position.col + 1 },
    ];

    const result = calculateChampionMove(gameState, "A", path, 3);

    expect(result.stopReason).toBe("arrived");
    expect(result.endPosition).toEqual(path[2]);
    expect(adventure.adventureTokens).toBeGreaterThan(0);
  });
});
