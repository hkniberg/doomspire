import { GameState } from "@/game/GameState";
import { CarriableItem, Champion, Decision, DecisionContext, DecisionOption, FateEffects, Player, Position, ResourceType, Tile } from "@/lib/types";
import { GameSettings } from "@/lib/GameSettings";

export interface Direction {
  row: number;
  col: number;
  name: string;
}

export const DIRECTIONS: Direction[] = [
  { row: -1, col: 0, name: "north" },
  { row: 1, col: 0, name: "south" },
  { row: 0, col: -1, name: "west" },
  { row: 0, col: 1, name: "east" },
];

/**
 * Check if a position is within the board bounds
 */
export function isValidBoardPosition(position: Position): boolean {
  return position.row >= 0 && position.row < 8 && position.col >= 0 && position.col < 8;
}

/**
 * Get a list of buildings that the player can afford to use
 */
export function getUsableBuildings(player: Player): string[] {
  const usableBuildings: string[] = [];

  // Check for Blacksmith
  const hasBlacksmith = player.buildings.includes("blacksmith");
  if (hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_USAGE_COST)) {
    usableBuildings.push("blacksmith");
  }

  // Check for Market
  const hasMarket = player.buildings.includes("market");
  if (hasMarket) {
    const totalResources = player.resources.food + player.resources.wood + player.resources.ore;
    if (totalResources >= GameSettings.MARKET_EXCHANGE_RATE) {
      usableBuildings.push("market");
    }
  }

  // Check for Fletcher
  const hasFletcher = player.buildings.includes("fletcher");
  if (hasFletcher && canAfford(player, GameSettings.FLETCHER_USAGE_COST)) {
    usableBuildings.push("fletcher");
  }

  return usableBuildings;
}


/**
 * Get the name of a CarriableItem
 */
function getItemName(item: CarriableItem): string {
  if (item.treasureCard) {
    return item.treasureCard.name;
  }
  if (item.traderItem) {
    return item.traderItem.name;
  }
  return 'Unknown Item';
}

/**
 * Result of a drop item decision
 */
export interface DropItemDecisionResult {
  /** The DecisionContext to present to the player */
  decisionContext: DecisionContext;
  /** Whether the decision includes an option to refuse the new item */
  canRefuse: boolean;
}

/**
 * Create a decision context for choosing what item to drop when inventory is full
 * 
 * @param championId - ID of the champion whose inventory is full
 * @param newItemName - Name of the new item being offered
 * @param champion - The champion whose inventory is full
 * @param newItemDescription - Optional description of what the new item does
 * @param canRefuseNewItem - Whether the player can refuse the new item (vs must drop something)
 * @param refuseActionText - Text for the refuse action (e.g., "Leave on ground", "Refuse item")
 * @returns DecisionContext and metadata about the decision
 */
export function createDropItemDecision(
  championId: number,
  newItemName: string,
  champion: Champion,
  newItemDescription?: string,
  canRefuseNewItem: boolean = true,
  refuseActionText: string = `Leave the ${newItemName} on the ground`
): DropItemDecisionResult {
  const droppableOptions: DecisionOption[] = [];

  // Add options to drop existing items (only if not stuck or unstealable)
  champion.items.forEach((item, index) => {
    if (!item.stuck) {
      const dropText = canRefuseNewItem
        ? `Drop ${getItemName(item)} and take the ${newItemName}`
        : `Drop ${getItemName(item)} for the ${newItemName}`;

      droppableOptions.push({
        id: `drop_${index}`,
        description: dropText
      });
    }
  });

  // Add refuse option if allowed
  if (canRefuseNewItem) {
    droppableOptions.push({
      id: "refuse_item",
      description: refuseActionText
    });
  }

  // Build the description
  let description = `Champion${championId}'s inventory is full!`;
  if (newItemDescription) {
    description += ` ${newItemDescription}`;
  }
  description += ` Choose what to do with the ${newItemName}:`;

  const decisionContext: DecisionContext = {
    description,
    options: droppableOptions
  };

  return {
    decisionContext,
    canRefuse: canRefuseNewItem
  };
}

/**
 * Handle the result of a drop item decision
 * 
 * @param decision - The player's decision
 * @param champion - The champion whose inventory is being modified
 * @param newItem - The new item being offered (null if just dropping)
 * @param tile - The tile where dropped items should be placed
 * @param championId - ID of the champion for logging
 * @param newItemName - Name of the new item for logging
 * @param logFn - Logging function
 * @returns true if the new item was taken, false if refused
 */
export function handleDropItemDecision(
  decision: Decision,
  champion: Champion,
  newItem: CarriableItem | null,
  tile: Tile,
  championId: number,
  newItemName: string,
  logFn: (type: string, content: string) => void
): boolean {
  if (decision.choice === "refuse_item") {
    // Player refused the new item
    if (newItem) {
      // Place the refused item on the tile
      if (!tile.items) {
        tile.items = [];
      }
      tile.items.push(newItem);
    }
    logFn("event", `Champion${championId} left the ${newItemName} on the ground.`);
    return false;
  } else {
    // Handle dropping an item based on the decision choice
    const itemIndex = parseInt(decision.choice.replace('drop_', ''), 10);
    if (itemIndex >= 0 && itemIndex < champion.items.length) {
      const itemToDrop = champion.items[itemIndex];

      // Remove the item from champion's inventory
      champion.items.splice(itemIndex, 1);

      // Add dropped item to tile
      if (!tile.items) {
        tile.items = [];
      }
      tile.items.push(itemToDrop);

      // Add new item to champion's inventory
      if (newItem) {
        champion.items.push(newItem);
      }

      const droppedItemName = getItemName(itemToDrop);
      logFn("event", `Champion${championId} dropped ${droppedItemName} and took the ${newItemName}.`);
      return true;
    } else {
      logFn("event", `Unknown drop decision: ${decision.choice}`);
      return false;
    }
  }
}

/**
 * Check if a player has a specific trader item among any of their champions
 */
export function hasTraderItem(player: Player, itemId: string): boolean {
  return player.champions.some(champion =>
    champion.items.some(item => item.traderItem?.id === itemId)
  );
}

/**
 * Check if a specific champion has a trader item
 */
export function championHasTraderItem(champion: Champion, itemId: string): boolean {
  return champion.items.some(item => item.traderItem?.id === itemId);
}

/**
 * Check if a specific champion has a follower
 */
export function championHasFollower(champion: Champion, followerId: string): boolean {
  return champion.followers.some((follower) => follower.id === followerId);
}

/**
 * Calculate the item carrying capacity for a champion (in slots)
 * Base capacity is 2, backpack adds 2 more (total 4 including the backpack itself),
 * the Abandoned Mule follower carries 2 more
 */
export function getChampionItemCapacity(champion: Champion): number {
  const baseCapacity = 2;
  const backpackBonus = championHasTraderItem(champion, "backpack") ? 2 : 0;
  const muleBonus = championHasFollower(champion, "abandoned-mule") ? 2 : 0;
  return baseCapacity + backpackBonus + muleBonus;
}

/**
 * Movement budget (max steps) for a champion movement using the given dice.
 * The Abandoned Mule follower caps each die at 2 steps; the Tailwind fate card
 * adds +1 step per movement (once per movement, even when sprinting with multiple dice).
 */
export function getChampionMovementBudget(champion: Champion, diceValues: number[], fateEffects: FateEffects): number {
  const hasMule = championHasFollower(champion, "abandoned-mule");
  const diceTotal = diceValues.reduce((sum, value) => sum + (hasMule ? Math.min(value, 2) : value), 0);
  return diceTotal + (fateEffects.knightMovementBonus || 0);
}

/**
 * How many item slots an item occupies (the Löng Swörd takes up 2 slots)
 */
export function getItemSlotSize(item: CarriableItem): number {
  return item.treasureCard?.id === "long-sword" ? 2 : 1;
}

/**
 * How many item slots a champion is currently using
 */
export function getChampionUsedItemSlots(champion: Champion): number {
  return champion.items.reduce((sum, item) => sum + getItemSlotSize(item), 0);
}

/**
 * Check if a champion can carry another item (of the given slot size, default 1)
 */
export function canChampionCarryMoreItems(champion: Champion, newItemSlots: number = 1): boolean {
  const capacity = getChampionItemCapacity(champion);
  return getChampionUsedItemSlots(champion) + newItemSlots <= capacity;
}

// Removed canAffordBuilding - use canAfford(player, GameSettings.BUILDING_COST) instead

/**
 * Deduct resources from a player's inventory
 */
export function deductResources(player: Player, resourceType: ResourceType, amount: number): boolean {
  if (player.resources[resourceType] < amount) {
    return false;
  }
  player.resources[resourceType] -= amount;
  return true;
}

/**
 * Deduct gold from a player's inventory
 */
export function deductGold(player: Player, amount: number): boolean {
  return deductResources(player, "gold", amount);
}

/**
 * Deduct ore from a player's inventory
 */
export function deductOre(player: Player, amount: number): boolean {
  return deductResources(player, "ore", amount);
}

/**
 * Deduct food from a player's inventory
 */
export function deductFood(player: Player, amount: number): boolean {
  return deductResources(player, "food", amount);
}

/**
 * Deduct wood from a player's inventory
 */
export function deductWood(player: Player, amount: number): boolean {
  return deductResources(player, "wood", amount);
}

/**
 * Check if a player can afford a given cost
 */
/**
 * Wrap a thinking logger so every thought is prefixed with the player's name.
 * Players can think in parallel (fate and harvest phases) and can be asked for decisions
 * outside their own turn (flee choices, combat support, council votes), so the thinking
 * content must carry its own attribution to be readable in the game log.
 */
export function prefixThinkingWithPlayerName(
  playerName: string,
  thinkingLogger?: (content: string) => void,
): ((content: string) => void) | undefined {
  return thinkingLogger ? (content: string) => thinkingLogger(`${playerName}: ${content}`) : undefined;
}

export function canAfford(player: Player, cost: Record<ResourceType, number>): boolean {
  return player.resources.food >= cost.food &&
    player.resources.wood >= cost.wood &&
    player.resources.ore >= cost.ore &&
    player.resources.gold >= cost.gold;
}

/**
 * Deduct resources from a player based on a cost object
 */
export function deductCost(player: Player, cost: Record<ResourceType, number>): void {
  player.resources.food -= cost.food;
  player.resources.wood -= cost.wood;
  player.resources.ore -= cost.ore;
  player.resources.gold -= cost.gold;
}
