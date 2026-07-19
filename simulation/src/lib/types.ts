// Lords of Doomspire Game Types

import type { TraderItem } from "../content/traderItems";
import type { TreasureCard } from "../content/treasureCards";

export type ResourceType = "food" | "wood" | "ore" | "gold";
export type MarketResourceType = "food" | "wood" | "ore";
export type TileTier = 1 | 2 | 3;
export type AdventureThemeType = "beast" | "cave" | "grove";
export type MonsterType = "beast" | "humanoid" | "troll" | "golem" | "plant" | "fey" | "undead" | "demon";
export type OceanPosition = "nw" | "ne" | "sw" | "se";
export type TileType =
  | "empty"
  | "home"
  | "resource"
  | "adventure"
  | "temple"
  | "trader"
  | "mercenary"
  | "doomspire"
  | "oasis"
  | "wolfDen"
  | "bearCave";

export const NON_COMBAT_TILES: TileType[] = ["home", "temple", "trader", "mercenary"];

export interface Position {
  row: number;
  col: number;
}

export type Path = Position[];

export interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface ReachablePosition {
  startPos: Position;
  endPos: Position;
  steps: number;
  paths: Path[];
}

export interface CarriableItem {
  treasureCard?: TreasureCard;
  traderItem?: TraderItem;
  stuck?: boolean; // If true, this item cannot be dropped by the champion
  unstealable?: boolean; // If true, this item cannot be stolen in combat
  combatBonus?: number; // Combat might bonus provided by this item
}

export interface Monster {
  id: string;
  name: string;
  tier: TileTier;
  icon: string;
  might: number; // Might needed to beat it
  fame: number; // Fame gained for winning
  resources: Record<ResourceType, number>; // Resources gained for beating it
  monsterType?: MonsterType; // Shown as a tag on the card; some items refer to these types
}

export interface Tile {
  position: Position;
  tier?: TileTier;
  explored?: boolean; // starts true for all tier 1 tiles, and false for all other tiles
  resources?: Record<ResourceType, number>; // Only applicable for resource tiles
  isStarred?: boolean; // Only applicable for resource tiles
  claimedBy?: string; // Player name who claimed this tile. Applicable for resource tiles and home tiles
  monster?: Monster; // only applicable for adventure tiles
  adventureTokens?: number; // Number of adventure tokens on the tile. Only applicable for adventure tiles
  tileType?: TileType;
  backColor?: string; // Background color set by BoardBuilder
  borderColor?: string; // Border color set by BoardBuilder
  tileGroup?: number; // Optional group identifier - when one tile in group is explored, all tiles in group are explored
  items?: CarriableItem[]; // Items present on this tile
  impressionCounter?: number; // Number of times the dragon has been impressed at this tile (only relevant for doomspire)
}

export interface Champion {
  id: number;
  position: Position;
  playerName: string;
  items: CarriableItem[]; // Items held by the champion
  followers: string[]; // not implemented yet.
}

export interface Boat {
  id: number;
  playerName: string;
  position: OceanPosition;
}

/**
 * Statistics counters for tracking player actions throughout the game
 */
export interface PlayerStatistics {
  championVsChampionWins: number;
  championVsChampionLosses: number;
  championVsMonsterWins: number;
  championVsMonsterLosses: number;
  dragonEncounters: number;
  marketInteractions: number;
  blacksmithInteractions: number;
  fletcherInteractions: number;
  traderInteractions: number;
  templeInteractions: number;
  mercenaryInteractions: number;
  championActions: number;
  boatActions: number;
  harvestActions: number;
  buildActions: number;
  adventureCards: number;
}

export interface Player {
  name: string;
  color: string; // Player's assigned color (hex code)
  fame: number;
  might: number;
  resources: Record<ResourceType, number>;
  maxClaims: number;
  champions: Champion[];
  boats: Boat[];
  buildings: BuildingType[]; // Buildings constructed in the player's castle
  homePosition: Position;
  extraInstructions?: string; // Optional extra instructions for AI players
  statistics?: PlayerStatistics; // Match statistics tracking
  finalRank?: "King of Doomspire" | "Hand of the King" | "Master of Coin" | "Court Jester"; // Final ranking when game ends
}


export type PlayerType = "random" | "claude" | "human";

/**
 * Player statistics snapshot for a single turn (combines counters and point-in-time data)
 */
export interface PlayerTurnStats {
  playerName: string;
  fame: number;
  might: number;
  food: number;
  wood: number;
  ore: number;
  gold: number;
  championCount: number;
  boatCount: number;
  totalItems: number;
  totalFollowers: number;
  championVsChampionWins: number;
  championVsChampionLosses: number;
  championVsMonsterWins: number;
  championVsMonsterLosses: number;
  dragonEncounters: number;
  marketInteractions: number;
  blacksmithInteractions: number;
  fletcherInteractions: number;
  traderInteractions: number;
  templeInteractions: number;
  mercenaryInteractions: number;
  championActions: number;
  boatActions: number;
  harvestActions: number;
  buildActions: number;
  adventureCards: number;
  claimedTiles: number;
  starredTiles: number;
  totalResourcesFromTiles: number;
  hasBlacksmith: boolean;
  hasMarket: boolean;
  hasFletcher: boolean;
  hasChapel: boolean;
  hasMonastery: boolean;
  hasWarshipUpgrade: boolean;
}

/**
 * Complete statistics for one turn (all players)
 */
export interface TurnStatistics {
  round: number;
  playerStats: PlayerTurnStats[];
}

/**
 * Turn context provided to players for dice decisions
 */
export interface TurnContext {
  turnNumber: number;
  diceRolled: number[];
  remainingDiceValues: number[];
}

/**
 * Option for a decision
 */
export interface DecisionOption {
  id: string;
  description: string;
}

/**
 * Context for runtime decisions that arise during action resolution
 */
export interface DecisionContext {
  description: string; // Human readable description of the situation
  options: DecisionOption[]; // Available choices
}

/**
 * Generic decision made by a player
 */
export interface Decision {
  choice: string; // The id from the chosen DecisionOption
  reasoning?: string; // Optional reasoning for debugging
}



export type GameLogEntryType = "dice" | "movement" | "boat" | "exploration" | "combat" | "harvest" | "assessment" | "event" | "system" | "victory" | "thinking" | "error";

/**
 * Tagged log entry in the sequential game log
 */
export interface GameLogEntry {
  round: number;
  playerName: string;
  type: GameLogEntryType;
  content: string; // High-level description of what happened
}

/**
 * Types of buildings that can be constructed in a player's castle
 */
export type BuildingType = "blacksmith" | "market" | "chapel" | "monastery" | "warshipUpgrade" | "fletcher";

export interface EventCardResult {
  eventProcessed: boolean;
  playersAffected?: string[];
  resourcesChanged?: Record<string, { food?: number; wood?: number; ore?: number; gold?: number }>;
  boatsMoved?: boolean;
  oasisTokensAdded?: number;
  errorMessage?: string;
}
