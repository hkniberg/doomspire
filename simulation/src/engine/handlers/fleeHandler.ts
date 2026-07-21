import { GameState } from "@/game/GameState";
import { CarriableItem, DecisionContext, DecisionOption, GameLogEntry, Player, Position, ResourceType, Tile } from "@/lib/types";
import { formatResources } from "@/lib/utils";
import { PlayerAgent } from "@/players/PlayerAgent";
import { canChampionCarryMoreItems, getItemSlotSize } from "@/players/PlayerUtils";

export interface FleeContext {
  combatType: 'champion' | 'monster';
  canFlee: boolean; // Monster combat: always true. Champion combat: only the defender may flee.
  gameState: GameState;
  player: Player;
  championId: number;
  tile: Tile;
  // For champion combat: the attacker receives the resource/item on a partial flee
  attackerPlayer?: Player;
  attackerChampionId?: number;
}

export interface FleeResult {
  attemptedFlee: boolean;
  fleeSuccessful?: boolean;
  destination?: Position;
  reasoning?: string;
}

/**
 * Roll a D3 (returns 1, 2, or 3 with equal probability)
 */
function rollD3(): number {
  const outcomes = [1, 1, 2, 2, 3, 3];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

/**
 * Find the closest unoccupied tile owned by the player
 */
export function findClosestOwnedTile(gameState: GameState, player: Player, currentPosition: Position): Position | null {
  const ownedTiles = gameState.board.findTiles(tile => tile.claimedBy === player.name);

  if (ownedTiles.length === 0) {
    return null;
  }

  let closestTile: Tile | null = null;
  let minDistance = Infinity;

  for (const tile of ownedTiles) {
    // Check if tile is safe (no opposing champions)
    const opposingChampions = gameState.getOpposingChampionsAtPosition(player.name, tile.position);
    if (opposingChampions.length > 0) {
      continue; // Tile has opposing champions
    }

    // Calculate Manhattan distance
    const distance = Math.abs(tile.position.row - currentPosition.row) +
      Math.abs(tile.position.col - currentPosition.col);

    if (distance < minDistance) {
      minDistance = distance;
      closestTile = tile;
    }
  }

  return closestTile ? closestTile.position : null;
}

/**
 * Handle the loss on a partial flee success.
 *
 * Monster combat: lose 1 resource of your choice (if none, lose 1 fame; if no fame, lose nothing).
 * Champion combat: GIVE 1 resource or item to the attacking player (fleeing player chooses).
 */
async function handlePartialFleeLoss(
  context: FleeContext,
  playerAgent: PlayerAgent,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<void> {
  const player = context.player;
  const championId = context.championId;
  const isPvpFlee = context.combatType === 'champion' && context.attackerPlayer !== undefined;

  const availableResourceTypes = (["food", "wood", "ore", "gold"] as ResourceType[]).filter(
    (type) => player.resources[type] > 0
  );

  // For PVP fleeing, items may also be given (if the attacker's champion has space)
  const champion = context.gameState.getChampion(player.name, championId);
  const attackerChampion = isPvpFlee && context.attackerPlayer && context.attackerChampionId !== undefined
    ? context.gameState.getChampion(context.attackerPlayer.name, context.attackerChampionId)
    : undefined;

  const givableItems: Array<{ item: CarriableItem; index: number }> = [];
  if (isPvpFlee && champion && attackerChampion) {
    champion.items.forEach((item, index) => {
      if (!item.stuck && !item.unstealable && canChampionCarryMoreItems(attackerChampion, getItemSlotSize(item))) {
        givableItems.push({ item, index });
      }
    });
  }

  // Nothing to lose or give
  if (availableResourceTypes.length === 0 && givableItems.length === 0) {
    if (isPvpFlee) {
      logFn("combat", `Champion${championId} fled with nothing to give to the attacker`);
    } else if (player.fame > 0) {
      player.fame--;
      logFn("combat", `Champion${championId} lost 1 fame from fleeing (no resources available)`);
    } else {
      logFn("combat", `Champion${championId} had no resources or fame to lose from fleeing`);
    }
    return;
  }

  // Build options
  const options: DecisionOption[] = [
    ...availableResourceTypes.map((type) => ({
      id: `resource_${type}`,
      description: `1 ${type} (you have ${player.resources[type]})`
    })),
    ...givableItems.map(({ item, index }) => {
      const itemName = item.treasureCard?.name || item.traderItem?.name || "Unknown Item";
      return { id: `item_${index}`, description: `Give item: ${itemName}` };
    })
  ];

  let choice: string;
  if (options.length === 1) {
    choice = options[0].id;
  } else {
    const currentResources = formatResources(player.resources, ", ");
    const decisionContext: DecisionContext = {
      description: isPvpFlee
        ? `Choose which resource or item to give to ${context.attackerPlayer!.name} for your escape (you have: ${currentResources}):`
        : `Choose which resource to lose from fleeing (you have: ${currentResources}):`,
      options
    };
    try {
      const decision = await playerAgent.makeDecision(context.gameState, gameLog, decisionContext, thinkingLogger);
      choice = options.some((o) => o.id === decision.choice) ? decision.choice : options[0].id;
    } catch (error) {
      choice = options[0].id;
    }
  }

  if (choice.startsWith("resource_")) {
    const resourceType = choice.split("_")[1] as ResourceType;
    player.resources[resourceType]--;
    if (isPvpFlee && context.attackerPlayer) {
      context.attackerPlayer.resources[resourceType]++;
      logFn("combat", `Champion${championId} gave 1 ${resourceType} to ${context.attackerPlayer.name} while fleeing`);
    } else {
      logFn("combat", `Champion${championId} lost 1 ${resourceType} from fleeing`);
    }
  } else if (choice.startsWith("item_") && champion && attackerChampion && context.attackerPlayer) {
    const itemIndex = parseInt(choice.split("_")[1]);
    if (itemIndex >= 0 && itemIndex < champion.items.length) {
      const givenItem = champion.items[itemIndex];
      champion.items.splice(itemIndex, 1);
      attackerChampion.items.push(givenItem);
      const itemName = givenItem.treasureCard?.name || givenItem.traderItem?.name || "Unknown Item";
      logFn("combat", `Champion${championId} gave ${itemName} to ${context.attackerPlayer.name} while fleeing`);
    }
  }
}

/**
 * Handle the flee decision and outcome.
 *
 * Roll 1D3:
 * - 1: Failure. Combat happens as normal.
 * - 2: Partial success. Knight flees to closest unoccupied owned tile (or home) and loses/gives 1 resource (or item, in PVP).
 * - 3: Success. Knight flees to home tile without any loss.
 *
 * Fleeing from the dragon is impossible.
 */
export async function handleFleeDecision(
  context: FleeContext,
  playerAgent: PlayerAgent,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<FleeResult> {
  // Check if fleeing is allowed
  if (!context.canFlee) {
    return {
      attemptedFlee: false,
      reasoning: "Cannot flee from this combat"
    };
  }

  // Create decision context for fight/flee choice
  const decisionContext: DecisionContext = {
    description: `Choose action for ${context.combatType} combat:`,
    options: [
      {
        id: "fight",
        description: "Fight"
      },
      {
        id: "flee",
        description: "Attempt to flee (1D3: 1 = fight anyway, 2 = escape but lose 1 resource, 3 = escape home safely)"
      }
    ]
  };

  // Ask player to decide
  const decision = await playerAgent.makeDecision(context.gameState, gameLog, decisionContext, thinkingLogger);

  if (decision.choice === "fight") {
    return {
      attemptedFlee: false,
      reasoning: decision.reasoning || "Chose to fight"
    };
  }

  // Player chose to flee - roll for outcome
  const fleeRoll = rollD3();
  logFn("combat", `Champion${context.championId} attempts to flee, rolled [${fleeRoll}]`);

  if (fleeRoll === 1) {
    // Failure - combat proceeds normally
    logFn("combat", `Flee attempt failed, combat proceeds`);
    return {
      attemptedFlee: true,
      fleeSuccessful: false,
      reasoning: decision.reasoning || "Flee attempt failed"
    };
  }

  const champion = context.gameState.getChampion(context.player.name, context.championId);
  if (!champion) {
    return {
      attemptedFlee: true,
      fleeSuccessful: false,
      reasoning: "Champion not found"
    };
  }

  if (fleeRoll === 2) {
    // Partial success - flee to closest owned tile and lose/give 1 resource (or item)
    const closestOwnedTile = findClosestOwnedTile(context.gameState, context.player, champion.position);

    let destination: Position;
    if (closestOwnedTile) {
      destination = closestOwnedTile;
      logFn("combat", `Champion${context.championId} fled to closest owned tile at (${destination.row}, ${destination.col})`);
    } else {
      destination = context.player.homePosition;
      logFn("combat", `Champion${context.championId} fled to home tile (no owned tiles available)`);
    }

    champion.position = destination;

    await handlePartialFleeLoss(context, playerAgent, gameLog, logFn, thinkingLogger);

    return {
      attemptedFlee: true,
      fleeSuccessful: true,
      destination,
      reasoning: decision.reasoning || "Fled to closest owned tile"
    };
  }

  // fleeRoll === 3 - Success - flee to home tile without loss
  champion.position = context.player.homePosition;
  logFn("combat", `Champion${context.championId} fled to home tile without loss`);

  return {
    attemptedFlee: true,
    fleeSuccessful: true,
    destination: context.player.homePosition,
    reasoning: decision.reasoning || "Fled to home"
  };
}
