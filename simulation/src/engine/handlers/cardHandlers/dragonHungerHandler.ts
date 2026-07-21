import { GameState } from "@/game/GameState";
import { EventCardResult } from "@/lib/types";

// Dragon Hunger reward thresholds (claimed tiles, including the home tile)
const TIER_1_TILES = 3; // +1 fame
const TIER_2_TILES = 5; // +1 fame, +1 might
const TIER_3_TILES = 7; // +1 fame, +1 might, +3 gold

/**
 * Handle the Dragon Hunger event card.
 * The dragon scours the island. Each lord counts their claimed tiles:
 * 3+ tiles = +1 fame. 5+ tiles = +1 fame, +1 might. 7+ tiles = +1 fame, +1 might, +3 gold.
 */
export function handleDragonHunger(
  gameState: GameState,
  logFn: (type: string, content: string) => void
): EventCardResult {
  logFn("event", "The Dragon flies overhead, scouring the island for resources!");

  const playersAffected: string[] = [];

  for (const player of gameState.players) {
    const claimedTiles = gameState.board.findTiles((tile) => tile.claimedBy === player.name).length;

    if (claimedTiles >= TIER_3_TILES) {
      player.fame += 1;
      player.might += 1;
      player.resources.gold += 3;
      logFn("event", `${player.name} has ${claimedTiles} claimed tiles: gains 1 fame, 1 might, and 3 gold`);
      playersAffected.push(player.name);
    } else if (claimedTiles >= TIER_2_TILES) {
      player.fame += 1;
      player.might += 1;
      logFn("event", `${player.name} has ${claimedTiles} claimed tiles: gains 1 fame and 1 might`);
      playersAffected.push(player.name);
    } else if (claimedTiles >= TIER_1_TILES) {
      player.fame += 1;
      logFn("event", `${player.name} has ${claimedTiles} claimed tiles: gains 1 fame`);
      playersAffected.push(player.name);
    } else {
      logFn("event", `${player.name} has only ${claimedTiles} claimed tiles: no reward`);
    }
  }

  return {
    eventProcessed: true,
    playersAffected
  };
}
