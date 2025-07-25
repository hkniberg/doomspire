// Lords of Doomspire Movement Execution

import { GameState } from "@/game/GameState";
import type { OceanPosition, Position } from "../../lib/types";

export interface MoveResult {
  endPosition: Position;
  stopReason: "arrived" | "diceValueReached" | "unexploredTile" | "invalidMove" | "outOfBounds" | "otherPlayerHome";
}

/**
 * Calculates the end position of a champion movement action.
 * Does not change any state.
 */
export function calculateChampionMove(
  gameState: GameState,
  playerName: string,
  pathIncludingStartPosition: Position[],
  diceValue: number,
): MoveResult {
  // If path is empty or only contains start position, no movement
  if (pathIncludingStartPosition.length <= 1) {
    return {
      endPosition: pathIncludingStartPosition[0] || { row: 0, col: 0 },
      stopReason: "arrived"
    };
  }

  // Start from the first position in path
  let currentPosition = pathIncludingStartPosition[0];
  let movesUsed = 0;

  // Get current player and all other players' home positions
  const currentPlayer = gameState.players.find(p => p.name === playerName);
  if (!currentPlayer) {
    throw new Error(`Player ${playerName} not found`);
  }

  const otherPlayersHomes = gameState.players
    .filter(p => p.name !== playerName)
    .map(p => p.homePosition);

  // Process each step in the path (starting from index 1, since 0 is start position)
  for (let i = 1; i < pathIncludingStartPosition.length; i++) {
    const nextPosition = pathIncludingStartPosition[i];

    // Validate that positions are adjacent (no diagonal moves)
    const rowDiff = Math.abs(nextPosition.row - currentPosition.row);
    const colDiff = Math.abs(nextPosition.col - currentPosition.col);

    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // Valid adjacent move
    } else {
      // Invalid move - stop at current position
      return {
        endPosition: currentPosition,
        stopReason: "invalidMove"
      };
    }

    // Validate position is within board bounds
    const tile = gameState.board.getTileAt(nextPosition);
    if (!tile) {
      // Position is out of bounds - stop at current position
      return {
        endPosition: currentPosition,
        stopReason: "outOfBounds"
      };
    }

    // Check if trying to enter another player's home tile
    const isOtherPlayerHome = otherPlayersHomes.some(homePos =>
      homePos.row === nextPosition.row && homePos.col === nextPosition.col
    );
    if (isOtherPlayerHome) {
      // Cannot enter another player's home - stop at current position
      return {
        endPosition: currentPosition,
        stopReason: "otherPlayerHome"
      };
    }

    // Check if tile is unexplored
    if (tile.explored === false) {
      // Stop at the unexplored tile
      return {
        endPosition: nextPosition,
        stopReason: "unexploredTile"
      };
    }

    // Move to next position and increment moves used
    currentPosition = nextPosition;
    movesUsed++;

    // Check if we've used all dice moves
    if (movesUsed >= diceValue) {
      return {
        endPosition: currentPosition,
        stopReason: "diceValueReached"
      };
    }
  }

  // Reached the end of the path
  return {
    endPosition: currentPosition,
    stopReason: "arrived"
  };
}


export interface BoatMoveResult {
  endPosition: OceanPosition;
  stopReason: "arrived" | "diceValueReached";
  championMoveResult: "championMoved" | "championNotReachableByBoat" | "targetPositionNotReachableByBoat";
}


/**
 * Calculate the result of a boat move. 
 * This includes the end position of the boat, the stop reason, and the result of the champion move.
 * Does not change any state.
 */
export function calculateBoatMove(
  pathIncludingStartPosition: OceanPosition[],
  diceValue: number,
  championStartPosition?: Position,
  championDropPosition?: Position,
): BoatMoveResult {
  // If path is empty or only contains start position, no movement
  if (pathIncludingStartPosition.length <= 1) {
    const endPosition = pathIncludingStartPosition[0] || "nw";

    // If no champion movement requested, just return boat result
    if (!championStartPosition || !championDropPosition) {
      return {
        endPosition,
        stopReason: "arrived",
        championMoveResult: "championMoved"
      };
    }

    // Check if champion movement is possible from this single position
    const coastalTiles = getCoastalTilesForOceanPosition(endPosition);
    const championStartReachable = coastalTiles.some(tile =>
      tile.row === championStartPosition.row && tile.col === championStartPosition.col
    );
    const championDropReachable = coastalTiles.some(tile =>
      tile.row === championDropPosition.row && tile.col === championDropPosition.col
    );

    if (!championStartReachable) {
      return {
        endPosition,
        stopReason: "arrived",
        championMoveResult: "championNotReachableByBoat"
      };
    }

    if (!championDropReachable) {
      return {
        endPosition,
        stopReason: "arrived",
        championMoveResult: "targetPositionNotReachableByBoat"
      };
    }

    return {
      endPosition,
      stopReason: "arrived",
      championMoveResult: "championMoved"
    };
  }

  // Track boat movement through the path
  let currentPosition = pathIncludingStartPosition[0];
  let movesUsed = 0;
  let allReachableCoastalTiles: Position[] = [];

  // Collect all coastal tiles the boat passes through (including start)
  allReachableCoastalTiles.push(...getCoastalTilesForOceanPosition(currentPosition));

  // Process each step in the path (starting from index 1, since 0 is start position)
  for (let i = 1; i < pathIncludingStartPosition.length; i++) {
    // Move to next position and increment moves used
    currentPosition = pathIncludingStartPosition[i];
    movesUsed++;

    // Add coastal tiles for this position
    allReachableCoastalTiles.push(...getCoastalTilesForOceanPosition(currentPosition));

    // Check if we've used all dice moves
    if (movesUsed >= diceValue) {
      break;
    }
  }

  const stopReason = movesUsed >= diceValue ? "diceValueReached" : "arrived";

  // If no champion movement requested, just return boat result
  if (!championStartPosition || !championDropPosition) {
    return {
      endPosition: currentPosition,
      stopReason,
      championMoveResult: "championMoved"
    };
  }

  // Check if champion start position is reachable by boat during its journey
  const championStartReachable = allReachableCoastalTiles.some(tile =>
    tile.row === championStartPosition.row && tile.col === championStartPosition.col
  );

  if (!championStartReachable) {
    return {
      endPosition: currentPosition,
      stopReason,
      championMoveResult: "championNotReachableByBoat"
    };
  }

  // Check if champion drop position is reachable by boat during its journey
  const championDropReachable = allReachableCoastalTiles.some(tile =>
    tile.row === championDropPosition.row && tile.col === championDropPosition.col
  );

  if (!championDropReachable) {
    return {
      endPosition: currentPosition,
      stopReason,
      championMoveResult: "targetPositionNotReachableByBoat"
    };
  }

  return {
    endPosition: currentPosition,
    stopReason,
    championMoveResult: "championMoved"
  };
}



/**
 * Get the coastal tiles that are adjacent to a given ocean position.
 * Based on game rules: each ocean zone touches 7 coastal tiles total.
 * TODO handle different board sizes
 */
export function getCoastalTilesForOceanPosition(oceanPosition: OceanPosition): Position[] {
  switch (oceanPosition) {
    case "nw":
      // Northwest: corner (0,0) + 3 east + 3 south
      return [
        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
        { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }
      ];
    case "ne":
      // Northeast: corner (0,7) + 3 west + 3 south
      return [
        { row: 0, col: 7 }, { row: 0, col: 6 }, { row: 0, col: 5 }, { row: 0, col: 4 },
        { row: 1, col: 7 }, { row: 2, col: 7 }, { row: 3, col: 7 }
      ];
    case "sw":
      // Southwest: corner (7,0) + 3 east + 3 north
      return [
        { row: 7, col: 0 }, { row: 7, col: 1 }, { row: 7, col: 2 }, { row: 7, col: 3 },
        { row: 6, col: 0 }, { row: 5, col: 0 }, { row: 4, col: 0 }
      ];
    case "se":
      // Southeast: corner (7,7) + 3 west + 3 north
      return [
        { row: 7, col: 7 }, { row: 7, col: 6 }, { row: 7, col: 5 }, { row: 7, col: 4 },
        { row: 6, col: 7 }, { row: 5, col: 7 }, { row: 4, col: 7 }
      ];
  }
}