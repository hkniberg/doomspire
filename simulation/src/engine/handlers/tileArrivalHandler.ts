import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { CarriableItem, GameLogEntry, Player, Tile, ResourceType, DecisionContext, DecisionOption } from "@/lib/types";
import { formatResources } from "@/lib/utils";
import { PlayerAgent } from "@/players/PlayerAgent";
import { canChampionCarryMoreItems } from "@/players/PlayerUtils";
import {
  resolveChampionVsChampionCombat,
  resolveChampionVsDragonEncounter,
  resolveChampionVsMonsterCombat
} from "./combatHandler";

export interface ChampionCombatResult {
  combatOccurred: boolean;
  attackerWon?: boolean;
}

export interface MonsterCombatResult {
  combatOccurred: boolean;
  championWon?: boolean;
}

export interface DragonCombatResult {
  combatOccurred: boolean;
  championWon?: boolean;
  championDefeated?: boolean;
  healingCost?: "gold" | "fame" | "none";
  combatDetails?: string;
}

export interface DoomspireResult {
  entered: boolean;
  alternativeVictory?: {
    type: "Fame Victory" | "Gold Victory" | "Economic Victory" | "Fame Victory (Final Impression)" | "Gold Victory (Final Impression)" | "Economic Victory (Final Impression)";
    playerName: string;
  };
  dragonCombat?: {
    championWon: boolean;
    championDefeated?: boolean;
    combatVictory?: {
      playerName: string;
    };
    combatDetails: string;
  };
  dragonImpressed?: {
    playerName: string;
    impressionType: string;
    impressionCount: number;
    needsResourceChoice: boolean;
  };
}

/**
 * Generate resource choice options for dragon impression rewards
 */
function generateResourceChoiceOptions(): DecisionOption[] {
  const resourceTypes: ResourceType[] = ["gold", "food", "wood", "ore"];
  const options: DecisionOption[] = [];

  // Generate all combinations of 2 resources (including same resource twice)
  for (let i = 0; i < resourceTypes.length; i++) {
    for (let j = i; j < resourceTypes.length; j++) {
      const resource1 = resourceTypes[i];
      const resource2 = resourceTypes[j];
      const optionId = `${resource1}-${resource2}`;
      const description = resource1 === resource2
        ? `2 ${resource1}`
        : `1 ${resource1} + 1 ${resource2}`;

      options.push({
        id: optionId,
        description
      });
    }
  }

  return options;
}

/**
 * Apply the chosen resource reward to the player
 */
function applyResourceChoice(player: Player, choice: string, logFn: (type: string, content: string) => void): void {
  const [resource1, resource2] = choice.split('-') as ResourceType[];

  player.resources[resource1] += 1;
  player.resources[resource2] += 1;

  const description = resource1 === resource2
    ? `2 ${resource1}`
    : `1 ${resource1} + 1 ${resource2}`;

  logFn("event", `${player.name} received ${description} from the dragon as reward for impressing it!`);
}



export interface SpecialTileResult {
  interactionOccurred: boolean;
  adventureCardDrawn?: boolean;
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

  // Mark tile as explored
  tile.explored = true;

  // Mark tile group as explored if it has one
  if (tile.tileGroup) {
    gameState.board.setTileGroupToExplored(tile.tileGroup);
  }

  // Award fame for exploration
  const fameAwarded = GameSettings.FAME_AWARD_FOR_EXPLORATION;
  player.fame += fameAwarded;

  logFn("exploration", `Explored new territory and got ${fameAwarded} fame`);
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
  getPlayerAgent?: (playerName: string) => PlayerAgent | undefined,
  isActivelyChosen: boolean = true // New parameter to determine if combat was actively chosen
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
    getPlayerAgent,
    isActivelyChosen
  );

  if (!combatResult.combatOccurred) {
    return { combatOccurred: false };
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
  isActivelyChosen: boolean = true, // New parameter to determine if combat was actively chosen
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<MonsterCombatResult> {
  const combatResult = await resolveChampionVsMonsterCombat(
    gameState,
    tile,
    player,
    championId,
    logFn,
    isActivelyChosen,
    playerAgent,
    gameLog,
    thinkingLogger
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
 * Handle arrival at the Doomspire tile (dragon combat and victory conditions)
 */
export async function handleDoomspireTile(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  isActivelyChosen: boolean = true, // New parameter to determine if combat was actively chosen
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<DoomspireResult> {
  const dragonEncounter = await resolveChampionVsDragonEncounter(
    gameState,
    tile,
    player,
    championId,
    logFn,
    isActivelyChosen,
    playerAgent,
    gameLog,
    thinkingLogger
  );

  if (!dragonEncounter.encounterOccurred) {
    return { entered: false };
  }

  if (dragonEncounter.alternativeVictory) {
    return {
      entered: true,
      alternativeVictory: dragonEncounter.alternativeVictory
    };
  }

  // Handle dragon impression (non-combat) 
  if (dragonEncounter.dragonImpressed) {
    const impression = dragonEncounter.dragonImpressed;

    if (impression.needsResourceChoice && playerAgent && gameLog) {
      // Let player choose 2 resources as reward
      const resourceOptions = generateResourceChoiceOptions();
      const decisionContext: DecisionContext = {
        description: `The dragon is impressed by your ${impression.impressionType.toLowerCase()} and offers you 2 resources of your choice as a reward!`,
        options: resourceOptions
      };

      const decision = await playerAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
      applyResourceChoice(player, decision.choice, logFn);

      // Send champion home
      const champion = gameState.getChampion(player.name, championId);
      if (champion) {
        champion.position = player.homePosition;
        logFn("event", `Champion${championId} was flown home by the grateful dragon.`);
      }
    }

    return {
      entered: true,
      dragonImpressed: impression
    };
  }

  if (dragonEncounter.combatResult) {
    const combatResult = dragonEncounter.combatResult;

    if (combatResult.victory) {
      // Handle resource choice for combat victories too
      if (combatResult.needsResourceChoice && playerAgent && gameLog) {
        const resourceOptions = generateResourceChoiceOptions();
        const decisionContext: DecisionContext = {
          description: "The dragon is impressed by your combat prowess and offers you 2 resources of your choice as a reward!",
          options: resourceOptions
        };

        const decision = await playerAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
        applyResourceChoice(player, decision.choice, logFn);

        // Send champion home
        const champion = gameState.getChampion(player.name, championId);
        if (champion) {
          champion.position = player.homePosition;
          logFn("event", `Champion${championId} was flown home by the grateful dragon.`);
        }
      }

      return {
        entered: true,
        dragonCombat: {
          championWon: true,
          combatVictory: combatResult.finalImpression ? {
            playerName: player.name
          } : undefined,
          combatDetails: combatResult.combatDetails!
        }
      };
    } else if (combatResult.defeat) {
      return {
        entered: true,
        dragonCombat: {
          championWon: false,
          championDefeated: true,
          combatDetails: combatResult.combatDetails!
        }
      };
    } else if (!combatResult.combatOccurred) {
      // This handles the case where the champion fled from the dragon
      return {
        entered: true,
        dragonCombat: {
          championWon: false,
          championDefeated: false,
          combatDetails: combatResult.combatDetails || "Champion fled from dragon"
        }
      };
    }
  }

  // Should not reach here
  return { entered: false };
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

  const currentClaimedCount = gameState.board.findTiles((tile) => tile.claimedBy === player.name).length;

  if (currentClaimedCount >= player.maxClaims) {
    logFn("event", `Champion${championId} could not claim resource tile (${tile.position.row}, ${tile.position.col}) (max claims reached)`);
    return;
  }

  // Successful claim
  tile.claimedBy = player.name;
  logFn("event", `Champion${championId} claimed resource tile (${tile.position.row}, ${tile.position.col}), which can provide ${formatResources(tile.resources)}`);
}

/**
 * Handle conquering and inciting revolt on resource tiles
 */
export function handleTileInteractions(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  conquerWithMight: boolean,
  inciteRevolt: boolean,
  logFn: (type: string, content: string) => void
): void {
  // Only one interaction method can be used
  if (conquerWithMight && inciteRevolt) {
    logFn("event", `Champion${championId} cannot use both might and fame interactions on tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  if (!conquerWithMight && !inciteRevolt) {
    return;
  }

  // Only resource tiles can be conquered or have revolt incited
  if (tile.tileType !== "resource") {
    logFn("event", `Champion${championId} cannot conquer or incite revolt on non-resource tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  // Tile must be claimed by another player
  if (tile.claimedBy === undefined || tile.claimedBy === player.name) {
    logFn("event", `Champion${championId} cannot conquer or incite revolt on unclaimed tile or own tile (${tile.position.row}, ${tile.position.col})`);
    return;
  }

  // Check if there are other knights on this tile (these actions should only happen after combat)
  const otherKnightsOnTile = gameState.getOpposingChampionsAtPosition(player.name, tile.position);
  if (otherKnightsOnTile.length > 0) {
    logFn("event", `Champion${championId} cannot conquer or incite revolt on tile (${tile.position.row}, ${tile.position.col}) - other knights are present`);
    return;
  }

  // Check if the tile is protected by adjacent knights
  if (gameState.isClaimProtected(tile)) {
    logFn("event", `Champion${championId} cannot conquer or incite revolt on tile (${tile.position.row}, ${tile.position.col}) - protected by adjacent knight of ${tile.claimedBy}`);
    return;
  }

  // Handle conquest with might
  if (conquerWithMight) {
    if (player.might <= 0) {
      logFn("event", `Champion${championId} cannot conquer with might - insufficient might (${player.might})`);
      return;
    }

    // Successful conquest with might
    const previousOwner = tile.claimedBy;
    tile.claimedBy = player.name;
    player.might = Math.max(0, player.might - GameSettings.CONQUEST_MIGHT_COST);
    logFn("event", `Champion${championId} conquered tile (${tile.position.row}, ${tile.position.col}) from ${previousOwner} using might. New might: ${player.might}`);
  }

  // Handle inciting revolt with fame
  if (inciteRevolt) {
    if (player.fame <= 0) {
      logFn("event", `Champion${championId} cannot incite revolt - insufficient fame (${player.fame})`);
      return;
    }

    // Successful revolt - removes claim but doesn't take over
    const previousOwner = tile.claimedBy;
    tile.claimedBy = undefined;
    player.fame = Math.max(0, player.fame - GameSettings.REVOLT_FAME_COST);
    logFn("event", `Champion${championId} incited revolt on tile (${tile.position.row}, ${tile.position.col}) from ${previousOwner} using fame. Tile is now unclaimed. New fame: ${player.fame}`);
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

    // Check inventory space
    if (!canChampionCarryMoreItems(champion)) {
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

  if (player.resources.gold < GameSettings.MERCENARY_GOLD_COST) {
    return {
      actionSuccessful: false,
      reason: `Not enough gold (need ${GameSettings.MERCENARY_GOLD_COST} gold)`
    };
  }

  // Successful mercenary purchase
  player.resources.gold -= GameSettings.MERCENARY_GOLD_COST;
  player.might += GameSettings.MERCENARY_MIGHT_REWARD;

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

  if (player.fame < GameSettings.TEMPLE_FAME_COST) {
    return {
      actionSuccessful: false,
      reason: `Not enough fame (need ${GameSettings.TEMPLE_FAME_COST} fame)`
    };
  }

  // Successful temple sacrifice
  player.fame -= GameSettings.TEMPLE_FAME_COST;
  player.might += GameSettings.TEMPLE_MIGHT_REWARD;

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