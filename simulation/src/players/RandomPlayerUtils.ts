// Random Player Utilities
// Reusable random operations for building different AI player variants

import { getTraderItemById } from "@/content/traderItems";
import { getEligibleHarvestTiles } from "@/engine/actions/harvestCalculator";
import { GameState } from "@/game/GameState";
import { DiceAction, HarvestDecision, TileAction } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { GameSettings } from "@/lib/GameSettings";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Player, Position } from "@/lib/types";
import { canAfford } from "./PlayerUtils";

// Random player behavior constants
export const RANDOM_CONSTANTS = {
  // Trader decision probabilities
  TRADER_BUY_ITEM_CHANCE: 0.3,

  // Building usage probabilities
  BLACKSMITH_USAGE_CHANCE: 0.3,
  MARKET_USAGE_CHANCE: 0.4,
  FLETCHER_USAGE_CHANCE: 0.25,
  BUILD_ACTION_CHANCE: 0.3,

  // Market selling probabilities
  SELL_FOOD_CHANCE: 0.5,
  SELL_WOOD_CHANCE: 0.5,
  SELL_ORE_CHANCE: 0.5,

  // Market selling limits
  MAX_RESOURCE_SELL_AMOUNT: 3,

  // Action generation limits
  MAX_BOAT_ACTIONS: 10,

  // Tile action probabilities
  CONQUER_CHANCE: 0.5,
  BRIBE_CHANCE: 0.5,
} as const;

/**
 * Randomly selects an element from an array
 */
export function randomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error("Cannot choose from empty array");
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Randomly selects a dice value from remaining dice
 */
export function randomDiceValue(remainingDiceValues: number[]): number {
  return randomChoice(remainingDiceValues);
}

/**
 * Generates random champion actions for a given dice value
 */
export function generateRandomChampionActions(
  gameState: GameState,
  playerName: string,
  dieValue: number,
  maxActions?: number
): DiceAction[] {
  const player = gameState.getPlayer(playerName);
  if (!player) return [];

  const actions: DiceAction[] = [];

  for (const champion of player.champions) {
    // Skip champions that have already interacted with a tile this round
    if (champion.hasInteractedThisRound) {
      continue;
    }

    // Simple action: stay in place and claim tile if possible
    actions.push({
      actionType: "championAction",
      championAction: {
        diceValueUsed: dieValue,
        championId: champion.id,
        movementPathIncludingStartPosition: [champion.position],
        tileAction: generateRandomTileAction(player),
      },
    });

    // Try some simple movements
    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dCol = -1; dCol <= 1; dCol++) {
        if (dRow === 0 && dCol === 0) continue; // Skip staying in place
        if (Math.abs(dRow) === Math.abs(dCol)) continue; // Skip diagonal moves for simplicity

        const newRow = champion.position.row + dRow * dieValue;
        const newCol = champion.position.col + dCol * dieValue;

        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
          actions.push({
            actionType: "championAction",
            championAction: {
              diceValueUsed: dieValue,
              championId: champion.id,
              movementPathIncludingStartPosition: [
                champion.position,
                { row: newRow, col: newCol },
              ],
              tileAction: generateRandomTileAction(player),
            },
          });
        }
      }
    }
  }

  return maxActions ? actions.slice(0, maxActions) : actions;
}

/**
 * Generates random boat actions for a given dice value
 */
export function generateRandomBoatActions(
  gameState: GameState,
  playerName: string,
  dieValue: number,
  maxActions: number = RANDOM_CONSTANTS.MAX_BOAT_ACTIONS
): DiceAction[] {
  const player = gameState.getPlayer(playerName);
  if (!player) return [];

  const actions: DiceAction[] = [];

  for (const boat of player.boats) {
    // Option 1: Stay in place
    actions.push({
      actionType: "boatAction",
      boatAction: {
        diceValueUsed: dieValue,
        boatId: boat.id,
        movementPathIncludingStartPosition: [boat.position],
      },
    });

    // Option 2: Move to neighboring ocean zones
    const neighboringZones = gameState.getNeighboringOceanZones(boat.position);
    for (const targetZone of neighboringZones) {
      // Simple move without champion transport
      actions.push({
        actionType: "boatAction",
        boatAction: {
          diceValueUsed: dieValue,
          boatId: boat.id,
          movementPathIncludingStartPosition: [boat.position, targetZone],
        },
      });

      // Option 3: Move and transport champion if available
      const championsInCoast = gameState.getChampionsInCoastalTiles(playerName, boat.position);
      if (championsInCoast.length > 0) {
        // Pick a random champion to transport
        const championToTransport = randomChoice(championsInCoast);

        // Get target coastal tiles and pick a random one
        const targetCoastalTiles = gameState.getCoastalTilesForOceanZone(targetZone);
        if (targetCoastalTiles.length > 0) {
          const randomTargetTile = randomChoice(targetCoastalTiles);

          actions.push({
            actionType: "boatAction",
            boatAction: {
              diceValueUsed: dieValue,
              boatId: boat.id,
              movementPathIncludingStartPosition: [boat.position, targetZone],
              championIdToPickUp: championToTransport.id,
              championDropPosition: randomTargetTile,
              championTileAction: generateRandomTileAction(player),
            },
          });
        }
      }
    }
  }

  return actions.slice(0, maxActions);
}

/**
 * Generates a harvest action (save a die for the harvest phase) for a given dice value.
 * Which tiles to harvest is decided later, during the harvest phase.
 */
export function generateRandomHarvestAction(
  gameState: GameState,
  playerName: string,
  dieValue: number
): DiceAction | null {
  const player = gameState.getPlayer(playerName);
  if (!player) return null;

  return {
    actionType: "harvestAction",
    harvestAction: {
      diceValuesUsed: [dieValue],
    },
  };
}

/**
 * Pick which tiles to harvest from during the harvest phase:
 * the eligible tiles with the highest total yield, up to the saved dice total.
 */
export function chooseBestHarvestTiles(
  gameState: GameState,
  playerName: string,
  savedDiceValues: number[]
): Position[] {
  const diceSum = savedDiceValues.reduce((sum, value) => sum + value, 0);
  if (diceSum === 0) return [];

  const totalYield = (tile: { resources?: Partial<Record<string, number>> }) =>
    Object.values(tile.resources || {}).reduce((sum: number, amount) => sum + (amount || 0), 0);

  return getEligibleHarvestTiles(gameState, playerName)
    .filter(tile => totalYield(tile) > 0)
    .sort((a, b) => totalYield(b) - totalYield(a))
    .slice(0, diceSum)
    .map(tile => tile.position);
}

/**
 * Generates a random tile action based on player resources
 */
export function generateRandomTileAction(player: Player): TileAction {
  const tileAction: TileAction = {
    claimTile: true, // Always try to claim
  };

  // Use trader is always true
  tileAction.useTrader = true;

  // Use mercenary if player has >= 3 gold
  if (player.resources.gold >= GameSettings.MERCENARY_GOLD_COST) {
    tileAction.useMercenary = true;
  }

  // Use temple if player has >= 3 fame
  if (player.fame >= GameSettings.TEMPLE_FAME_COST) {
    tileAction.useTemple = true;
  }

  // Conquer if player has enough fame (50% chance)
  if (player.fame >= GameSettings.CONQUER_FAME_COST && Math.random() < RANDOM_CONSTANTS.CONQUER_CHANCE) {
    tileAction.conquer = true;
  }
  // Bribe if player has enough gold (50% chance, only if not conquering)
  else if (player.resources.gold >= GameSettings.BRIBE_GOLD_COST && Math.random() < RANDOM_CONSTANTS.BRIBE_CHANCE) {
    tileAction.bribe = true;
  }

  return tileAction;
}

/**
 * Makes a random trader decision (specifically looks for spear)
 */
export function makeRandomTraderDecision(
  traderContext: TraderContext,
  buyItemChance: number = RANDOM_CONSTANTS.TRADER_BUY_ITEM_CHANCE
): TraderDecision {
  const playerResources = traderContext.playerResources;
  const availableItems = traderContext.availableItems;

  const actions: any[] = [];

  // Look for spear specifically
  if (playerResources.gold > 0 && availableItems.length > 0) {
    const spearItem = availableItems.find(item => item.id === "spear");

    if (spearItem) {
      const traderItem = getTraderItemById(spearItem.id);
      if (traderItem && playerResources.gold >= traderItem.cost) {
        actions.push({
          type: "buyItem",
          itemId: spearItem.id
        });
      }
    }
  }

  return {
    actions: actions,
  };
}

/**
 * Generates random building usage decisions
 */
export function generateRandomBuildingUsage(player: Player): any {
  const buildingUsageDecision: any = {};

  // Random blacksmith usage (30% chance if affordable)
  if (player.buildings.includes("blacksmith") &&
    canAfford(player, GameSettings.BLACKSMITH_USAGE_COST) &&
    Math.random() < RANDOM_CONSTANTS.BLACKSMITH_USAGE_CHANCE) {
    buildingUsageDecision.useBlacksmith = true;
  }

  // Random market usage (40% chance if have resources to sell)
  if (player.buildings.includes("market")) {
    const sellableResources = player.resources.food + player.resources.wood + player.resources.ore;
    if (sellableResources > GameSettings.MARKET_EXCHANGE_RATE && Math.random() < RANDOM_CONSTANTS.MARKET_USAGE_CHANCE) {
      buildingUsageDecision.sellAtMarket = {};

      // Randomly sell some resources
      if (player.resources.food > 0 && Math.random() < RANDOM_CONSTANTS.SELL_FOOD_CHANCE) {
        buildingUsageDecision.sellAtMarket.food = Math.floor(Math.random() * Math.min(RANDOM_CONSTANTS.MAX_RESOURCE_SELL_AMOUNT, player.resources.food)) + 1;
      }
      if (player.resources.wood > 0 && Math.random() < RANDOM_CONSTANTS.SELL_WOOD_CHANCE) {
        buildingUsageDecision.sellAtMarket.wood = Math.floor(Math.random() * Math.min(RANDOM_CONSTANTS.MAX_RESOURCE_SELL_AMOUNT, player.resources.wood)) + 1;
      }
      if (player.resources.ore > 0 && Math.random() < RANDOM_CONSTANTS.SELL_ORE_CHANCE) {
        buildingUsageDecision.sellAtMarket.ore = Math.floor(Math.random() * Math.min(RANDOM_CONSTANTS.MAX_RESOURCE_SELL_AMOUNT, player.resources.ore)) + 1;
      }
    }
  }

  // Random fletcher usage (25% chance if affordable)
  if (player.buildings.includes("fletcher") &&
    canAfford(player, GameSettings.FLETCHER_USAGE_COST) &&
    Math.random() < RANDOM_CONSTANTS.FLETCHER_USAGE_CHANCE) {
    buildingUsageDecision.useFletcher = true;
  }

  return buildingUsageDecision;
}

/**
 * Gets available build actions for a player
 */
export function getAvailableBuildActions(player: Player): string[] {
  const availableActions: string[] = [];

  // Check Blacksmith (2 Food + 2 Ore, max 1 per player)
  const hasBlacksmith = player.buildings.includes("blacksmith");
  if (!hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_COST)) {
    availableActions.push("blacksmith");
  }

  // Check Market (2 Food + 2 Wood, max 1 per player)
  const hasMarket = player.buildings.includes("market");
  if (!hasMarket && canAfford(player, GameSettings.MARKET_COST)) {
    availableActions.push("market");
  }

  // Check Fletcher (1 Wood + 1 Food + 1 Gold + 1 Ore, max 1 per player)
  const hasFletcher = player.buildings.includes("fletcher");
  if (!hasFletcher && canAfford(player, GameSettings.FLETCHER_COST)) {
    availableActions.push("fletcher");
  }

  // Check Chapel (6 Wood + 2 Gold, only once per player)
  const hasChapel = player.buildings.includes("chapel");
  const hasMonastery = player.buildings.includes("monastery");
  if (!hasChapel && !hasMonastery && canAfford(player, GameSettings.CHAPEL_COST)) {
    availableActions.push("chapel");
  }

  // Check Monastery upgrade (8 Wood + 3 Gold + 1 Ore, requires chapel)
  if (hasChapel && !hasMonastery && canAfford(player, GameSettings.MONASTERY_COST)) {
    availableActions.push("upgradeChapelToMonastery");
  }

  // Check Champion recruitment (max 3 total)
  const currentChampionCount = player.champions.length;
  if (currentChampionCount < GameSettings.MAX_CHAMPIONS_PER_PLAYER) {
    if (canAfford(player, GameSettings.CHAMPION_COST)) {
      availableActions.push("recruitChampion");
    }
  }

  // Check Boat building (max 2 boats total)
  const currentBoatCount = player.boats.length;
  if (currentBoatCount < GameSettings.MAX_BOATS_PER_PLAYER && canAfford(player, GameSettings.BOAT_COST)) {
    availableActions.push("buildBoat");
  }

  // Check Warship upgrade (2 Wood + 1 Ore + 1 Gold, max 1 per player)
  const hasWarshipUpgrade = player.buildings.includes("warshipUpgrade");
  if (!hasWarshipUpgrade && canAfford(player, GameSettings.WARSHIP_UPGRADE_COST)) {
    availableActions.push("warshipUpgrade");
  }

  return availableActions;
}

/**
 * Makes a random build action selection
 */
export function makeRandomBuildAction(
  player: Player,
  buildChance: number = RANDOM_CONSTANTS.BUILD_ACTION_CHANCE
): string | null {
  if (Math.random() >= buildChance) {
    return null;
  }

  const availableBuildActions = getAvailableBuildActions(player);
  if (availableBuildActions.length === 0) {
    return null;
  }

  return randomChoice(availableBuildActions);
}

/**
 * Generates a complete random harvest phase decision:
 * harvest the best eligible tiles, plus random building usage and build action.
 */
export function makeRandomHarvestDecision(
  gameState: GameState,
  player: Player,
  savedDiceValues: number[]
): HarvestDecision {
  const result: HarvestDecision = {};

  // Harvest the highest-yield eligible tiles with the saved dice
  const harvestTiles = chooseBestHarvestTiles(gameState, player.name, savedDiceValues);
  if (harvestTiles.length > 0) {
    result.harvestTiles = harvestTiles;
  }

  // Random building usage decisions
  const buildingUsageDecision = generateRandomBuildingUsage(player);
  if (Object.keys(buildingUsageDecision).length > 0) {
    result.buildingUsageDecision = buildingUsageDecision;
  }

  // Random build action
  const buildAction = makeRandomBuildAction(player);
  if (buildAction) {
    result.buildAction = buildAction as any; // Type assertion for now
  }

  return result;
}