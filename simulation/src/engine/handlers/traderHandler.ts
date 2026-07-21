import { getTraderItemById } from "@/content/traderItems";
import { GameState } from "@/game/GameState";
import { GameDecks } from "@/lib/cards";
import { TraderAction, TraderContext, TraderDecision } from "@/lib/traderTypes";
import { CarriableItem, Player, ResourceType } from "@/lib/types";
import { formatResources } from "@/lib/utils";
import { canChampionCarryMoreItems } from "@/players/PlayerUtils";




export interface TraderResult {
  interactionOccurred: boolean;
  itemsPurchased: Array<{
    itemId: string;
    goldSpent: number;
  }>;
  resourceTrades: Array<{
    resourcesGiven: Record<ResourceType, number>;
    resourceReceived: ResourceType;
    goldReceived: number;
  }>;
  totalGoldSpent: number;
  totalGoldReceived: number;
  failedActions: Array<{
    action: TraderAction;
    reason: string;
  }>;
}

/**
 * Create trader context with available items and player resources
 */
export function createTraderContext(
  player: Player,
  gameDecks: GameDecks,
  gameState?: GameState
): TraderContext {
  const availableItems = gameDecks.getAvailableTraderCards(); // Get available items from deck
  const exchangeRate = gameState?.fateEffects.traderRate1to1 ? 1 : 2;

  const description = `Trader options available:
- Purchase items from trader deck (${availableItems.length} items available)
- Exchange resources at ${exchangeRate}:1 rate (pay ${exchangeRate} of any resource, get 1 of any other resource)${exchangeRate === 1 ? " (Merchant Fair: 1:1 this round!)" : ""}
- Your current resources: ${formatResources(player.resources)}`;

  return {
    availableItems,
    playerResources: { ...player.resources },
    description
  };
}

/**
 * Handle trader interactions when a player visits a trader tile
 */
export function handleTraderInteraction(
  gameState: GameState,
  player: Player,
  championId: number,
  traderDecision: TraderDecision,
  gameDecks: GameDecks,
  logFn: (type: string, content: string) => void
): TraderResult {
  const result: TraderResult = {
    interactionOccurred: traderDecision.actions.length > 0,
    itemsPurchased: [],
    resourceTrades: [],
    totalGoldSpent: 0,
    totalGoldReceived: 0,
    failedActions: []
  };

  if (!result.interactionOccurred) {
    logFn("event", "Visited trader but made no purchases or trades");
    return result;
  }

  // Process each trader action
  for (const action of traderDecision.actions) {
    if (action.type === "buyItem") {
      const buyResult = processBuyItemAction(gameState, player, championId, action, gameDecks, logFn);
      if (buyResult.success) {
        result.itemsPurchased.push({
          itemId: action.itemId!,
          goldSpent: buyResult.goldSpent!
        });
        result.totalGoldSpent += buyResult.goldSpent!;
      } else {
        result.failedActions.push({
          action,
          reason: buyResult.reason!
        });
      }
    } else if (action.type === "sellResources") {
      const sellResult = processSellResourcesAction(gameState, player, action, logFn);
      if (sellResult.success) {
        result.resourceTrades.push({
          resourcesGiven: action.resourcesSold!,
          resourceReceived: action.resourceRequested!,
          goldReceived: sellResult.goldReceived!
        });
        result.totalGoldReceived += sellResult.goldReceived!;
      } else {
        result.failedActions.push({
          action,
          reason: sellResult.reason!
        });
      }
    }
  }

  // Log summary if any successful trades occurred
  if (result.itemsPurchased.length > 0 || result.resourceTrades.length > 0) {
    let summary = "Trader interactions: ";
    const parts = [];

    if (result.itemsPurchased.length > 0) {
      parts.push(`purchased ${result.itemsPurchased.length} item(s) for ${result.totalGoldSpent} gold`);
    }

    if (result.resourceTrades.length > 0) {
      parts.push(`made ${result.resourceTrades.length} resource trade(s) gaining ${result.totalGoldReceived} gold`);
    }

    summary += parts.join(", ");
    logFn("event", summary);

    // Track statistics
    if (player.statistics) {
      player.statistics.traderInteractions += 1;
    }
  }

  return result;
}

/**
 * Process a buy item action
 */
function processBuyItemAction(
  gameState: GameState,
  player: Player,
  championId: number,
  action: TraderAction,
  gameDecks: GameDecks,
  logFn: (type: string, content: string) => void
): { success: boolean; goldSpent?: number; reason?: string } {
  if (!action.itemId) {
    return { success: false, reason: "No item ID specified" };
  }

  // Find the trader item definition
  const traderItem = getTraderItemById(action.itemId);
  if (!traderItem) {
    return { success: false, reason: `Unknown trader item: ${action.itemId}` };
  }

  // Check if the item is available in the trader deck
  const availableItems = gameDecks.getAvailableTraderCards();
  if (!availableItems.some(item => item.id === action.itemId)) {
    return { success: false, reason: `Item ${traderItem.name} is no longer available` };
  }

  // Find the champion
  const champion = gameState.getChampion(player.name, championId);
  if (!champion) {
    return { success: false, reason: `Champion ${championId} not found` };
  }

  // Check if player has enough gold
  if (player.resources.gold < traderItem.cost) {
    return {
      success: false,
      reason: `Not enough gold. Need ${traderItem.cost}, have ${player.resources.gold}`
    };
  }

  // If champion's inventory is full, drop the first non-stuck item to the ground
  if (!canChampionCarryMoreItems(champion)) {
    const currentTile = gameState.board.getTileAt(champion.position);
    if (!currentTile) {
      return { success: false, reason: `Champion ${championId} position is invalid` };
    }

    // Find the first non-stuck item to drop
    let droppedItem: CarriableItem | undefined;
    let dropIndex = -1;

    for (let i = 0; i < champion.items.length; i++) {
      if (!champion.items[i].stuck) {
        droppedItem = champion.items[i];
        dropIndex = i;
        break;
      }
    }

    // If all items are stuck, refuse the purchase
    if (!droppedItem || dropIndex === -1) {
      return {
        success: false,
        reason: `Champion ${championId} cannot purchase ${traderItem.name} - inventory is full of stuck items that cannot be dropped`
      };
    }

    // Remove the droppable item from champion's inventory
    champion.items.splice(dropIndex, 1);

    // Initialize tile items array if it doesn't exist
    if (!currentTile.items) {
      currentTile.items = [];
    }
    currentTile.items.push(droppedItem);

    // Get item name for logging
    const droppedItemName = droppedItem.treasureCard?.name || droppedItem.traderItem?.name || 'Unknown Item';
    logFn("event", `Champion ${championId} dropped ${droppedItemName} to make space for new purchase`);
  }

  // Remove item from trader deck
  const removed = gameDecks.removeTraderCard(action.itemId);
  if (!removed) {
    return { success: false, reason: `Failed to remove ${traderItem.name} from trader deck` };
  }

  // Deduct gold and add item to champion's inventory as CarriableItem
  player.resources.gold -= traderItem.cost;

  // Mark backpack as unstealable (cannot be stolen but can be dropped)
  const isBackpack = traderItem.id === "backpack";
  champion.items.push({
    traderItem,
    unstealable: isBackpack
  });

  logFn("event", `Champion ${championId} purchased ${traderItem.name} for ${traderItem.cost} gold`);

  return { success: true, goldSpent: traderItem.cost };
}

/**
 * Process a sell resources action (2:1 exchange rate, or 1:1 during a Merchant Fair)
 */
function processSellResourcesAction(
  gameState: GameState,
  player: Player,
  action: TraderAction,
  logFn: (type: string, content: string) => void
): { success: boolean; goldReceived?: number; reason?: string } {
  if (!action.resourcesSold || !action.resourceRequested) {
    return { success: false, reason: "Missing resources offered or requested" };
  }

  // The trader allows any-resource-to-any-resource trades at a 2:1 rate
  // (1:1 during a Merchant Fair fate card)
  const exchangeRate = gameState.fateEffects.traderRate1to1 ? 1 : 2;
  const totalResourcesOffered = Object.values(action.resourcesSold).reduce((sum, amount) => sum + amount, 0);

  if (totalResourcesOffered === 0) {
    return { success: false, reason: "No resources offered for trade" };
  }

  // Check if player has the resources they want to trade
  for (const [resourceType, amount] of Object.entries(action.resourcesSold)) {
    const playerAmount = player.resources[resourceType as ResourceType];
    if (playerAmount < amount) {
      return {
        success: false,
        reason: `Not enough ${resourceType}. Need ${amount}, have ${playerAmount}`
      };
    }
  }

  // Calculate what they get
  const amountReceived = Math.floor(totalResourcesOffered / exchangeRate);

  if (amountReceived === 0) {
    return { success: false, reason: `Need at least ${exchangeRate} resources to make a trade` };
  }

  // Deduct offered resources
  for (const [resourceType, amount] of Object.entries(action.resourcesSold)) {
    player.resources[resourceType as ResourceType] -= amount;
  }

  // Add received resource
  player.resources[action.resourceRequested] += amountReceived;

  const offeredText = Object.entries(action.resourcesSold)
    .filter(([_, amount]) => amount > 0)
    .map(([type, amount]) => `${amount} ${type}`)
    .join(", ");

  logFn("event", `Traded ${offeredText} for ${amountReceived} ${action.resourceRequested} at trader`);

  // Return gold received only if they requested gold
  const goldReceived = action.resourceRequested === "gold" ? amountReceived : 0;
  return { success: true, goldReceived };
} 