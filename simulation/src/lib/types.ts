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
  tileGroup?: number; // Optional group identifier used during board placement
  items?: CarriableItem[]; // Items present on this tile
  treasureStacks?: Record<ResourceType, number>[]; // Dragon's treasure hoard stacks (only relevant for doomspire)
}

/**
 * A follower that has joined a champion (obtained through adventure cards)
 */
export interface Follower {
  id: string; // Encounter card id
  name: string;
}

export interface Champion {
  id: number;
  position: Position;
  playerName: string;
  items: CarriableItem[]; // Items held by the champion
  followers: Follower[]; // Followers accompanying the champion (max 2)
  hasInteractedThisRound?: boolean; // Once a champion interacts with a tile, it cannot use more action dice this round
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
  dragonImpressions: number; // Number of times this player has impressed the dragon (2 = win)
  champions: Champion[];
  boats: Boat[];
  buildings: BuildingType[]; // Buildings constructed in the player's castle
  homePosition: Position;
  extraInstructions?: string; // Optional extra instructions for AI players
  statistics?: PlayerStatistics; // Match statistics tracking
  finalRank?: "King of Doomspire" | "Hand of the King" | "Master of Coin" | "Court Jester"; // Final ranking when game ends
  impressedDragonThisRound?: boolean; // A player can impress the dragon at most once per round
  specialTileUsesThisRound?: Partial<Record<"temple" | "mercenary" | "trader", boolean>>; // Special locations can only be used once per round
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
  /** If the player's previous dice action was rejected as invalid, the error message (for a retry prompt) */
  previousError?: string;
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



export type GameLogEntryType = "dice" | "movement" | "boat" | "exploration" | "combat" | "harvest" | "assessment" | "event" | "system" | "victory" | "thinking" | "error" | "fate" | "building";

/**
 * The four phases of a round, as defined in the game rules.
 */
export type GamePhase = "fate" | "roll" | "move" | "harvest";

/**
 * Round-scoped effects from the current fate card. Reset at the start of each round.
 */
export interface FateEffects {
  fateCardId?: string;
  fateCardName?: string;
  fateCardEffect?: string; // The card's effect text, so prompts can show what the card does
  settling?: boolean; // No deliberate combat: knights cannot move into a tile with another knight or a creature
  noPvpCombat?: boolean; // Ceasefire: no PVP combat, knights pass through freely
  harvestBlockedForAll?: boolean; // Famine
  harvestBlockedForPlayer?: string; // Harvest Ban target
  doubleHarvest?: boolean; // Bountiful Harvest
  noBoatMovement?: boolean; // Fog of War
  noBoatTransport?: boolean; // Storm Season
  boatMovementBonus?: number; // Favorable Winds
  lockdownPlayer?: string; // Lockdown target: cannot move knights this round
  dicePenaltyPlayer?: string; // Penalty target: rolls one fewer die this round (minimum 1)
  traderRate1to1?: boolean; // Merchant Fair
  buildCostReduction?: boolean; // Merchant Fair
  dragonMightModifier?: number; // Dragon Sleeping (-2)
  dragonCombatImpressionOnly?: boolean; // Dragon Sleeping: only combat impresses
  dragonAbsent?: boolean; // Dragon Off Hunting
}

/**
 * Tagged log entry in the sequential game log
 */
export interface GameLogEntry {
  round: number;
  phase: GamePhase; // Which round phase the entry belongs to
  playerName?: string; // The acting player. Undefined for table-wide entries (fate phase, roll phase, game end).
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
