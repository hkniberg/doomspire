import { OceanPosition, Position } from './types';

export interface MoveChampionAction {
  championId: number;
  pathIncludingStartPosition: Position[];
  claimTile?: boolean; // If true, claims the destination tile (last position in path)
}

export interface MoveBoatAction {
  boatId: number;
  pathIncludingStartPosition: OceanPosition[]; // Ocean tiles as strings
  championId?: number; // Optional champion being picked up
  championDropPosition?: Position; // Where to drop off the champion
  claimTile?: boolean; // If true, claims the destination tile at champion drop position
}

export interface HarvestAction {
  tilePositions: Position[]; // Tiles to harvest from
}
// Nested DiceAction structure for Claude communication (matches schema)
export interface DiceAction {
  type: "moveChampion" | "moveBoat" | "harvest";
  moveChampion?: MoveChampionAction;
  moveBoat?: MoveBoatAction;
  harvest?: HarvestAction;
  diceValueUsed: number;
  reasoning?: string;
}
