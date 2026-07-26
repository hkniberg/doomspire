import { GameState } from "@/game/GameState";
import { EventCardResult, OceanPosition } from "@/lib/types";

/**
 * Handle the Sudden Storm event card
 */
export function handleSuddenStorm(
  gameState: GameState,
  logFn: (type: string, content: string) => void
): EventCardResult {
  logFn("event", "Sudden Storm! All boats move into an adjacent ocean zone. All oases and mountain tiles gain +1 adventure token.");

  // Move all boats to adjacent ocean positions
  const movedBoats: string[] = [];
  for (const player of gameState.players) {
    for (const boat of player.boats) {
      const originalPosition = boat.position; // Store original position
      const newPosition = getAdjacentOceanPosition(boat.position);
      boat.position = newPosition;

      // Determine boat identifier for logging
      const boatIdentifier = player.boats.length > 1 ? ` ${boat.id}` : '';
      const logMessage = `${player.name}'s boat${boatIdentifier} moved from ${originalPosition} to ${newPosition}`;

      movedBoats.push(logMessage);
      logFn("event", logMessage);
    }
  }

  // The mountains are the tier 3 tiles in the centre; only their adventure tiles hold tokens
  let restockedCount = 0;
  gameState.board.forEachTile((tile) => {
    const isMountainAdventure = tile.tier === 3 && tile.tileType === "adventure";
    if (tile.tileType === "oasis" || isMountainAdventure) {
      tile.adventureTokens = (tile.adventureTokens || 0) + 1;
      restockedCount++;
    }
  });

  if (restockedCount > 0) {
    logFn("event", `${restockedCount} oasis and mountain tiles gained +1 adventure token`);
  }

  return {
    eventProcessed: true,
    boatsMoved: true,
    adventureTokensAdded: restockedCount
  };
}

/**
 * Get an adjacent ocean position for sudden storm event
 */
function getAdjacentOceanPosition(currentPosition: OceanPosition): OceanPosition {
  const adjacencyMap: Record<OceanPosition, OceanPosition[]> = {
    "nw": ["ne", "sw"],
    "ne": ["nw", "se"],
    "sw": ["nw", "se"],
    "se": ["ne", "sw"]
  };

  const adjacentPositions = adjacencyMap[currentPosition];
  const randomIndex = Math.floor(Math.random() * adjacentPositions.length);
  return adjacentPositions[randomIndex];
} 