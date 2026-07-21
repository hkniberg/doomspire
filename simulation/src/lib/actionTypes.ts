import { MarketResourceType, OceanPosition, Position } from './types';

export interface ChampionAction {
  diceValueUsed: number;
  diceValuesUsed?: number[]; // Optional: combine multiple dice into one longer movement (sprinting). If set, diceValueUsed is ignored.
  championId: number;
  movementPathIncludingStartPosition?: Position[];
  tileAction?: TileAction;
}

export interface TileAction {
  claimTile?: boolean;
  useTrader?: boolean;
  useMercenary?: boolean;
  useTemple?: boolean;
  pickUpItems?: string[]; // Array of item IDs to pick up from the tile
  dropItems?: string[]; // Array of item IDs to drop on the tile
  conquer?: boolean; // Conquer another player's unprotected resource tile by force (costs 2 fame)
  bribe?: boolean; // Take over another player's unprotected resource tile through bribery (costs 2 gold)
}

export interface BoatAction {
  diceValueUsed: number;
  boatId: number;
  movementPathIncludingStartPosition?: OceanPosition[]; // Ocean tiles as strings
  championIdToPickUp?: number; // Optional champion being picked up
  championDropPosition?: Position; // Where to drop off the champion
  championTileAction?: TileAction;
}

/**
 * Move phase: save one or more dice for the harvest phase.
 * Which tiles to harvest from is decided later, during the harvest phase (see HarvestDecision).
 */
export interface HarvestAction {
  diceValuesUsed: number[];
}

// Build action is now just a string representing the type of build action
export type BuildAction = "blacksmith" | "market" | "recruitChampion" | "buildBoat" | "chapel" | "upgradeChapelToMonastery" | "warshipUpgrade" | "fletcher";

export interface BuildingUsageDecision {
  useBlacksmith?: boolean;
  sellAtMarket?: Record<MarketResourceType, number>;
  useFletcher?: boolean;
}

/**
 * The harvest phase decision, made by each player simultaneously during the harvest phase:
 * which tiles to harvest from (with dice saved during the move phase),
 * which buildings to use, and which build action to perform.
 */
export interface HarvestDecision {
  harvestTiles?: Position[]; // Tiles to harvest from. Max number of tiles = total value of saved dice.
  buildingUsageDecision?: BuildingUsageDecision;
  buildAction?: BuildAction;
  reasoning?: string;
}

// Dice actions no longer include build actions
export interface DiceAction {
  actionType: "championAction" | "boatAction" | "harvestAction";
  championAction?: ChampionAction;
  boatAction?: BoatAction;
  harvestAction?: HarvestAction;
  reasoning?: string;
}
