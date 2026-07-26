import { GameState } from "@/game/GameState";
import { EventCardResult } from "@/lib/types";

/**
 * Handle the You Got Riches! event card
 * A shouting genie grants wishes - all players get resources and all oases gain adventure tokens
 */
export function handleYouGotRiches(
  gameState: GameState,
  logFn: (type: string, content: string) => void
): EventCardResult {
  logFn("event", "You got riches! A shouting genie is granting everyone wishes!");

  // Give all players 1 of each resource
  const resourcesChanged: Record<string, { food?: number; wood?: number; ore?: number; gold?: number }> = {};

  for (const player of gameState.players) {
    player.resources.food += 1;
    player.resources.wood += 1;
    player.resources.ore += 1;
    player.resources.gold += 1;

    resourcesChanged[player.name] = {
      food: 1,
      wood: 1,
      ore: 1,
      gold: 1
    };

    logFn("event", `${player.name} receives 1 food, 1 wood, 1 ore, and 1 gold from the genie's wishes`);
  }

  let oasisCount = 0;
  gameState.board.forEachTile((tile) => {
    if (tile.tileType === "oasis") {
      tile.adventureTokens = (tile.adventureTokens || 0) + 1;
      oasisCount++;
    }
  });

  if (oasisCount > 0) {
    logFn("event", `All ${oasisCount} oasis tiles gained +1 adventure token from the genie's magic`);
  }

  return {
    eventProcessed: true,
    playersAffected: gameState.players.map(p => p.name),
    resourcesChanged,
    adventureTokensAdded: oasisCount
  };
} 