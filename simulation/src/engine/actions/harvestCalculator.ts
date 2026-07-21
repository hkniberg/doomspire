// Lords of Doomspire Harvest Calculation

import { GameState } from "@/game/GameState";
import { Position, ResourceType, Tile } from "@/lib/types";

export interface HarvestResult {
  harvestedTileCount: number;
  harvestedTilePositions: Position[];
  harvestedResources: Record<ResourceType, number>;
}

/**
 * Whether a player can currently harvest from a tile:
 * - Their own claimed tile, unless it is blockaded
 * - Another player's tile that they are blockading
 */
function canHarvestFrom(gameState: GameState, playerName: string, tile: Tile): boolean {
  if (!tile.resources || tile.claimedBy === undefined) {
    return false;
  }

  const blockader = gameState.getClaimBlockader(tile);

  if (tile.claimedBy === playerName) {
    // The owner can harvest unless the tile is actually blockaded.
    // A protected tile (owner has a knight adjacent) cannot be blockaded,
    // so an opposing knight standing on it does not stop the harvest.
    return blockader === null;
  }

  // Tile owned by someone else: can only harvest if this player is blockading it
  return blockader === playerName;
}

/**
 * Get all tiles a player can currently harvest from (own unblockaded claims + tiles they blockade)
 */
export function getEligibleHarvestTiles(gameState: GameState, playerName: string): Tile[] {
  return gameState.board.findTiles((tile) => canHarvestFrom(gameState, playerName, tile));
}

/**
 * Calculates the result of harvesting the chosen tiles (decided during the harvest phase).
 * Tiles are deduplicated, must be eligible, and the number of different tiles is capped
 * by the total value of the saved dice.
 *
 * Does not change any state.
 */
export function calculateHarvest(
  gameState: GameState,
  playerName: string,
  tilePositionsToHarvest: Position[],
  totalDiceValueUsed: number,
): HarvestResult {
  const player = gameState.players.find(p => p.name === playerName);
  if (!player) {
    throw new Error(`Player ${playerName} not found`);
  }

  const harvestedResources: Record<ResourceType, number> = {
    food: 0,
    wood: 0,
    ore: 0,
    gold: 0,
  };

  const eligibleTiles = getEligibleHarvestTiles(gameState, playerName);
  const selectedTiles: Tile[] = [];

  const isSelected = (tile: Tile) =>
    selectedTiles.some(t => t.position.row === tile.position.row && t.position.col === tile.position.col);

  // Chosen tiles, where eligible (deduplicated - die value = number of DIFFERENT tiles)
  for (const position of tilePositionsToHarvest) {
    if (selectedTiles.length >= totalDiceValueUsed) break;
    const tile = eligibleTiles.find(t => t.position.row === position.row && t.position.col === position.col);
    if (tile && !isSelected(tile)) {
      selectedTiles.push(tile);
    }
  }

  // Harvest all resources from each selected tile
  for (const tile of selectedTiles) {
    harvestedResources.food += tile.resources!.food || 0;
    harvestedResources.wood += tile.resources!.wood || 0;
    harvestedResources.ore += tile.resources!.ore || 0;
    harvestedResources.gold += tile.resources!.gold || 0;
  }

  return {
    harvestedTileCount: selectedTiles.length,
    harvestedTilePositions: selectedTiles.map(t => t.position),
    harvestedResources
  };
} 