import { handleBuildAction } from "@/engine/handlers/buildActionHandler";
import { GameState } from "@/game/GameState";

// Regression test for a real bug from the 2026-07-19 playtest: champion IDs were
// assigned as champions.length + 1, so after a champion died (eaten by the dragon)
// a newly recruited champion collided with a surviving champion's id.
describe("Champion recruitment IDs", () => {
  const noLog = () => { };

  function createRichGameState(): GameState {
    return GameState.createWithPlayerNames(
      ["A", "B", "C", "D"],
      { food: 20, wood: 20, ore: 20, gold: 20 }
    );
  }

  test("recruits get sequential ids after the starting champion", () => {
    const gameState = createRichGameState();
    const player = gameState.players[0];

    handleBuildAction(player, "recruitChampion", noLog, undefined, gameState);
    handleBuildAction(player, "recruitChampion", noLog, undefined, gameState);

    expect(player.champions.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  test("no duplicate id when recruiting after a champion died", () => {
    const gameState = createRichGameState();
    const player = gameState.players[0];

    handleBuildAction(player, "recruitChampion", noLog, undefined, gameState);
    handleBuildAction(player, "recruitChampion", noLog, undefined, gameState);

    // Champion 1 is eaten by the dragon
    player.champions.splice(0, 1);
    expect(player.champions.map((c) => c.id)).toEqual([2, 3]);

    // The new recruit must not reuse id 2 or 3 (the old count-based logic produced 3)
    handleBuildAction(player, "recruitChampion", noLog, undefined, gameState);
    const ids = player.champions.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([2, 3, 4]);
  });
});
