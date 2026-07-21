import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { CarriableItem, GameLogEntry, Player, ResourceType, Tile } from "@/lib/types";
import { formatResources } from "@/lib/utils";
import { PlayerAgent } from "@/players/PlayerAgent";
import { canChampionCarryMoreItems, getItemSlotSize } from "@/players/PlayerUtils";
import {
  GetPlayerAgent,
  resolveChampionVsChampionCombat,
  resolveChampionVsDragonEncounter,
  resolveChampionVsMonsterCombat
} from "./combatHandler";

export interface ChampionCombatResult {
  combatOccurred: boolean;
  attackerWon?: boolean;
  defenderFled?: boolean; // The defender fled successfully, so no combat took place
}

export interface MonsterCombatResult {
  combatOccurred: boolean;
  championWon?: boolean;
}

export interface DoomspireResult {
  entered: boolean;
  impressed?: boolean;
  gameWon?: boolean; // Player reached the required number of dragon impressions
  championEaten?: boolean;
}

export interface SpecialTileResult {
  interactionOccurred: boolean;
  adventureCardDrawn?: boolean;
}

/**
 * Create the dragon's treasure hoard when Doomspire is revealed:
 * 3 of each resource type (12 in total), randomly organized into 3 stacks of 4.
 */
function createDragonTreasureHoard(tile: Tile, logFn: (type: string, content: string) => void): void {
  const pool: ResourceType[] = [];
  for (const type of ["food", "wood", "ore", "gold"] as ResourceType[]) {
    for (let i = 0; i < GameSettings.DRAGON_TREASURE_PER_RESOURCE_TYPE; i++) {
      pool.push(type);
    }
  }

  // Shuffle the pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Split into stacks
  const stackCount = GameSettings.DRAGON_TREASURE_STACK_COUNT;
  const stackSize = pool.length / stackCount;
  const stacks: Record<ResourceType, number>[] = [];
  for (let s = 0; s < stackCount; s++) {
    const stack: Record<ResourceType, number> = { food: 0, wood: 0, ore: 0, gold: 0 };
    for (let i = 0; i < stackSize; i++) {
      stack[pool[s * stackSize + i]] += 1;
    }
    stacks.push(stack);
  }

  tile.treasureStacks = stacks;
  logFn("event", `The dragon's treasure hoard is revealed: ${stackCount} stacks of ${stackSize} resources each.`);
}

/**
 * Handle tile exploration when a champion arrives at an unexplored tile
 */
export function handleExploration(
  gameState: GameState,
  tile: Tile,
  player: Player,
  logFn: (type: string, content: string) => void
): void {
  if (tile.explored) {
    return;
  }

  // Mark tile as explored (only this tile - each tile is flipped individually)
  tile.explored = true;

  // Award fame for exploration
  const fameAwarded = GameSettings.FAME_AWARD_FOR_EXPLORATION;
  player.fame += fameAwarded;

  logFn("exploration", `Explored new territory and got ${fameAwarded} fame`);

  // When Doomspire is revealed, the dragon's treasure hoard is also revealed
  if (tile.tileType === "doomspire") {
    createDragonTreasureHoard(tile, logFn);
  }
}

/**
 * Handle champion vs champion combat on tile arrival
 */
export async function handleChampionCombat(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  playerAgent: PlayerAgent,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<ChampionCombatResult> {
  const combatResult = await resolveChampionVsChampionCombat(
    gameState,
    tile,
    player,
    championId,
    playerAgent,
    gameLog,
    logFn,
    thinkingLogger,
    getPlayerAgent
  );

  if (!combatResult.combatOccurred) {
    return { combatOccurred: false, defenderFled: combatResult.defenderFled };
  }

  if (combatResult.victory) {
    return {
      combatOccurred: true,
      attackerWon: true
    };
  } else {
    return {
      combatOccurred: true,
      attackerWon: false
    };
  }
}

/**
 * Handle combat with monsters on the tile
 */
export async function handleMonsterCombat(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<MonsterCombatResult> {
  const combatResult = await resolveChampionVsMonsterCombat(
    gameState,
    tile,
    player,
    championId,
    logFn,
    playerAgent,
    gameLog,
    thinkingLogger,
    getPlayerAgent
  );

  if (!combatResult.combatOccurred) {
    return { combatOccurred: false };
  }

  if (combatResult.victory) {
    return {
      combatOccurred: true,
      championWon: true
    };
  } else {
    return {
      combatOccurred: true,
      championWon: false
    };
  }
}

/**
 * Handle arrival at the Doomspire tile (impressing the dragon, or dragon combat)
 */
export async function handleDoomspireTile(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<DoomspireResult> {
  const dragonEncounter = await resolveChampionVsDragonEncounter(
    gameState,
    tile,
    player,
    championId,
    logFn,
    playerAgent,
    gameLog,
    thinkingLogger,
    getPlayerAgent
  );

  if (!dragonEncounter.encounterOccurred) {
    return { entered: false };
  }

  return {
    entered: true,
    impressed: dragonEncounter.impressed,
    gameWon: dragonEncounter.gameWon,
    championEaten: dragonEncounter.championEaten
  };
}

/**
 * Handle claiming of resource tiles
 */
export function handleTileClaiming(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  claimTile: boolean,
  logFn: (type: string, content: string) => void
): void {
  if (!claimTile) {
    return;
  }

  if (tile.tileType !== "resource") {
    return;
  }

  if (tile.claimedBy !== undefined) {
    return;
  }

  // Successful claim
  tile.claimedBy = player.name;
  logFn("event", `Champion${championId} claimed resource tile (${tile.position.row}, ${tile.position.col}), which can provide ${formatResources(tile.resources)}`);
}

/**
 * Handle taking over another player's unprotected resource tile:
 * - Conquer (2 fame): seize the tile by force
 * - Bribe (2 gold): take over the tile through corruption
 */
export function handleTileInteractions(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  conquer: boolean,
  bribe: boolean,
  logFn: (type: string, content: string) => void
): void {
  // Only one takeover method can be used
  if (conquer && bribe) {
    logFn("event", `Champion${championId} cannot both conquer and bribe on tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  if (!conquer && !bribe) {
    return;
  }

  // Only resource tiles can be taken over
  if (tile.tileType !== "resource") {
    logFn("event", `Champion${championId} cannot take over non-resource tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  // Tile must be claimed by another player
  if (tile.claimedBy === undefined || tile.claimedBy === player.name) {
    logFn("event", `Champion${championId} cannot take over unclaimed tile or own tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  // Check if there are other knights on this tile (these actions should only happen after combat)
  const otherKnightsOnTile = gameState.getOpposingChampionsAtPosition(player.name, tile.position);
  if (otherKnightsOnTile.length > 0) {
    logFn("event", `Champion${championId} cannot take over tile (${tile.position.row}, ${tile.position.col}) - other knights are present`);
    return;
  }

  // Check if the tile is protected by adjacent knights
  if (gameState.isClaimProtected(tile)) {
    logFn("event", `Champion${championId} cannot take over tile (${tile.position.row}, ${tile.position.col}) - protected by adjacent knight of ${tile.claimedBy}`);
    return;
  }

  // Handle conquest with fame
  if (conquer) {
    if (player.fame < GameSettings.CONQUER_FAME_COST) {
      logFn("event", `Champion${championId} cannot conquer - insufficient fame (need ${GameSettings.CONQUER_FAME_COST}, have ${player.fame})`);
      return;
    }

    const previousOwner = tile.claimedBy;
    tile.claimedBy = player.name;
    player.fame -= GameSettings.CONQUER_FAME_COST;
    logFn("event", `Champion${championId} conquered tile (${tile.position.row}, ${tile.position.col}) from ${previousOwner} by force, sacrificing ${GameSettings.CONQUER_FAME_COST} fame. New fame: ${player.fame}`);
  }

  // Handle bribery with gold
  if (bribe) {
    if (player.resources.gold < GameSettings.BRIBE_GOLD_COST) {
      logFn("event", `Champion${championId} cannot bribe - insufficient gold (need ${GameSettings.BRIBE_GOLD_COST}, have ${player.resources.gold})`);
      return;
    }

    const previousOwner = tile.claimedBy;
    tile.claimedBy = player.name;
    player.resources.gold -= GameSettings.BRIBE_GOLD_COST;
    logFn("event", `Champion${championId} took over tile (${tile.position.row}, ${tile.position.col}) from ${previousOwner} through bribery, paying ${GameSettings.BRIBE_GOLD_COST} gold`);
  }
}

/**
 * Handle special tiles (adventure/oasis) that provide cards
 */
export function handleSpecialTiles(
  tile: Tile,
  championId: number,
  logFn: (type: string, content: string) => void
): SpecialTileResult {
  if ((tile.tileType !== "adventure" && tile.tileType !== "oasis") ||
    !tile.adventureTokens || tile.adventureTokens <= 0) {
    return { interactionOccurred: false };
  }

  // Remove one adventure token
  tile.adventureTokens = Math.max(0, tile.adventureTokens - 1);

  return {
    interactionOccurred: true,
    adventureCardDrawn: true
  };
}

export interface ItemManagementResult {
  failedPickups: Array<{
    itemId: string;
    reason: string;
  }>;
  failedDrops: Array<{
    itemId: string;
    reason: string;
  }>;
}

export interface MercenaryResult {
  actionSuccessful?: boolean;
  reason?: string;
}

export interface TempleResult {
  actionSuccessful?: boolean;
  reason?: string;
}

/**
 * Handle item pickup and drop actions
 */
export function handleItemManagement(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  pickUpItems: string[] = [],
  dropItems: string[] = [],
  logFn: (type: string, content: string) => void
): ItemManagementResult {
  const result: ItemManagementResult = {
    failedPickups: [],
    failedDrops: []
  };

  const champion = gameState.getChampion(player.name, championId);
  if (!champion) {
    return result;
  }

  // Initialize tile items array if it doesn't exist
  if (!tile.items) {
    tile.items = [];
  }

  // Handle item drops first (to potentially make space for pickups)
  for (const itemId of dropItems) {
    const itemToDropObj = findCarriableItemById(champion.items, itemId);
    if (!itemToDropObj) {
      result.failedDrops.push({
        itemId,
        reason: "Champion doesn't have this item"
      });
      continue;
    }

    // Check if item is stuck and cannot be dropped
    if (itemToDropObj.stuck) {
      const itemName = getCarriableItemName(itemToDropObj);
      result.failedDrops.push({
        itemId,
        reason: `${itemName} is stuck and cannot be dropped`
      });
      logFn("event", `Champion ${championId} tried to drop ${itemName} but it's stuck!`);
      continue;
    }

    // Remove from champion inventory and add to tile
    const itemIndex = champion.items.indexOf(itemToDropObj);
    champion.items.splice(itemIndex, 1);
    tile.items.push(itemToDropObj);

    const itemName = getCarriableItemName(itemToDropObj);
    logFn("event", `Champion ${championId} dropped ${itemName} on tile (${tile.position.row}, ${tile.position.col})`);
  }

  // Handle item pickups
  for (const itemId of pickUpItems) {
    const itemToPickUpObj = findCarriableItemById(tile.items, itemId);
    if (!itemToPickUpObj) {
      result.failedPickups.push({
        itemId,
        reason: "Item not available on this tile"
      });
      continue;
    }

    // Check inventory space (some items, like the Löng Swörd, take up 2 slots)
    if (!canChampionCarryMoreItems(champion, getItemSlotSize(itemToPickUpObj))) {
      result.failedPickups.push({
        itemId,
        reason: "Champion inventory is full"
      });
      continue;
    }

    // Remove from tile and add to champion inventory
    const itemIndex = tile.items.indexOf(itemToPickUpObj);
    tile.items.splice(itemIndex, 1);
    champion.items.push(itemToPickUpObj);

    const itemName = getCarriableItemName(itemToPickUpObj);
    logFn("event", `Champion ${championId} picked up ${itemName} from tile (${tile.position.row}, ${tile.position.col})`);
  }

  return result;
}

/**
 * Handle mercenary camp action (buy might for gold)
 */
export function handleMercenaryAction(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  useMercenary: boolean,
  logFn: (type: string, content: string) => void
): MercenaryResult {
  if (!useMercenary) {
    return {};
  }

  if (tile.tileType !== "mercenary") {
    return {
      actionSuccessful: false,
      reason: "Can only use mercenary action on mercenary tiles"
    };
  }

  // Special locations can only be used once per round
  if (player.specialTileUsesThisRound?.mercenary) {
    return {
      actionSuccessful: false,
      reason: "Mercenary camp already used this round (once per round)"
    };
  }

  if (player.resources.gold < GameSettings.MERCENARY_GOLD_COST) {
    return {
      actionSuccessful: false,
      reason: `Not enough gold (need ${GameSettings.MERCENARY_GOLD_COST} gold)`
    };
  }

  // Successful mercenary purchase
  player.resources.gold -= GameSettings.MERCENARY_GOLD_COST;
  player.might += GameSettings.MERCENARY_MIGHT_REWARD;
  player.specialTileUsesThisRound = { ...player.specialTileUsesThisRound, mercenary: true };

  logFn("event", `Champion ${championId} hired mercenaries for ${GameSettings.MERCENARY_GOLD_COST} gold, gaining ${GameSettings.MERCENARY_MIGHT_REWARD} might`);

  // Track statistics
  if (player.statistics) {
    player.statistics.mercenaryInteractions += 1;
  }

  return {
    actionSuccessful: true
  };
}

/**
 * Handle temple action (sacrifice fame for might)
 */
export function handleTempleAction(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  useTemple: boolean,
  logFn: (type: string, content: string) => void
): TempleResult {
  if (!useTemple) {
    return {};
  }

  if (tile.tileType !== "temple") {
    return {
      actionSuccessful: false,
      reason: "Can only use temple action on temple tiles"
    };
  }

  // Special locations can only be used once per round
  if (player.specialTileUsesThisRound?.temple) {
    return {
      actionSuccessful: false,
      reason: "Temple already used this round (once per round)"
    };
  }

  if (player.fame < GameSettings.TEMPLE_FAME_COST) {
    return {
      actionSuccessful: false,
      reason: `Not enough fame (need ${GameSettings.TEMPLE_FAME_COST} fame)`
    };
  }

  // Successful temple sacrifice
  player.fame -= GameSettings.TEMPLE_FAME_COST;
  player.might += GameSettings.TEMPLE_MIGHT_REWARD;
  player.specialTileUsesThisRound = { ...player.specialTileUsesThisRound, temple: true };

  logFn("event", `Champion ${championId} sacrificed ${GameSettings.TEMPLE_FAME_COST} fame at the temple, gaining ${GameSettings.TEMPLE_MIGHT_REWARD} might`);

  // Track statistics
  if (player.statistics) {
    player.statistics.templeInteractions += 1;
  }

  return {
    actionSuccessful: true
  };
}

// Helper function to find a CarriableItem by ID (either treasure or trader item)
function findCarriableItemById(items: CarriableItem[], itemId: string): CarriableItem | undefined {
  return items.find(item =>
    item.treasureCard?.id === itemId || item.traderItem?.id === itemId
  );
}

// Helper function to get the ID of a CarriableItem
function getCarriableItemId(item: CarriableItem): string {
  return item.treasureCard?.id || item.traderItem?.id || 'unknown';
}

// Helper function to get the name of a CarriableItem
function getCarriableItemName(item: CarriableItem): string {
  return item.treasureCard?.name || item.traderItem?.name || 'Unknown Item';
} 