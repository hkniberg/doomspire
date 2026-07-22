import { GameState } from "@/game/GameState";
import { CarriableItem, Decision, DecisionContext, DecisionOption, GameLogEntry, Player, Position, ResourceType, Tile } from "@/lib/types";
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
      logFn("combat", `${player.name}'s champion${championId} fled with nothing to give to the attacker`);
    } else if (player.fame > 0) {
      player.fame--;
      logFn("combat", `${player.name}'s champion${championId} lost 1 fame from fleeing (no resources available)`);
    } else {
      logFn("combat", `${player.name}'s champion${championId} had no resources or fame to lose from fleeing`);
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
      logFn("combat", `${player.name}'s champion${championId} gave 1 ${resourceType} to ${context.attackerPlayer.name} while fleeing`);
    } else {
      logFn("combat", `${player.name}'s champion${championId} lost 1 ${resourceType} from fleeing`);
    }
  } else if (choice.startsWith("item_") && champion && attackerChampion && context.attackerPlayer) {
    const itemIndex = parseInt(choice.split("_")[1]);
    if (itemIndex >= 0 && itemIndex < champion.items.length) {
      const givenItem = champion.items[itemIndex];
      champion.items.splice(itemIndex, 1);
      attackerChampion.items.push(givenItem);
      const itemName = givenItem.treasureCard?.name || givenItem.traderItem?.name || "Unknown Item";
      logFn("combat", `${player.name}'s champion${championId} gave ${itemName} to ${context.attackerPlayer.name} while fleeing`);
    }
  }
}

/**
 * Exact probability that the defender wins a PVP fight, given fixed modifiers
 * (might + support). Both sides roll 2D3 and ties are rerolled, so this is the
 * probability of winning conditional on the tie being broken. Ignores item/follower
 * bonuses and support from other players, which are decided after the roll.
 */
function pvpDefenderWinProbability(defenderModifier: number, attackerModifier: number): number {
  let defenderWins = 0;
  let attackerWins = 0;
  for (let a1 = 1; a1 <= 3; a1++) {
    for (let a2 = 1; a2 <= 3; a2++) {
      for (let d1 = 1; d1 <= 3; d1++) {
        for (let d2 = 1; d2 <= 3; d2++) {
          const attackerTotal = attackerModifier + a1 + a2;
          const defenderTotal = defenderModifier + d1 + d2;
          if (defenderTotal > attackerTotal) {
            defenderWins++;
          } else if (attackerTotal > defenderTotal) {
            attackerWins++;
          }
        }
      }
    }
  }
  return defenderWins / (defenderWins + attackerWins);
}

/**
 * Exact probability that the champion beats a monster: roll 1D3, win if
 * might + support + roll >= monster might (ties go to the champion).
 * Ignores item/follower bonuses, which are decided after the roll.
 */
function monsterWinProbability(championModifier: number, monsterMight: number): number {
  let wins = 0;
  for (let roll = 1; roll <= 3; roll++) {
    if (championModifier + roll >= monsterMight) {
      wins++;
    }
  }
  return wins / 3;
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

  // Describe the combat situation, including automatic support from each side's
  // own adjacent units, so the player can judge the odds before deciding
  const positionText = `(${context.tile.position.row}, ${context.tile.position.col})`;
  const ownSupport = context.gameState.getCombatSupport(context.player.name, context.tile.position, context.championId);
  const ownStrengthText = `Your combat strength: might ${context.player.might}${ownSupport > 0 ? ` + ${ownSupport} support from your nearby units` : ""} + your dice roll.`;

  let situationText = "";
  if (context.combatType === 'champion' && context.attackerPlayer) {
    const attackerSupport = context.gameState.getCombatSupport(context.attackerPlayer.name, context.tile.position, context.attackerChampionId);
    const attackerStrengthText = `might ${context.attackerPlayer.might}${attackerSupport > 0 ? ` + ${attackerSupport} support from their nearby units` : ""} + their dice roll`;
    const winChance = pvpDefenderWinProbability(context.player.might + ownSupport, context.attackerPlayer.might + attackerSupport);
    const oddsText = `Your chance to win if you fight: ~${Math.round(winChance * 100)}% (ignoring item/follower bonuses and possible support from other players).`;
    situationText = `${context.attackerPlayer.name}'s champion${context.attackerChampionId} (${attackerStrengthText}) is attacking your champion${context.championId} at ${positionText}. ${ownStrengthText} ${oddsText} `;
  } else if (context.tile.monster) {
    const monster = context.tile.monster;
    const winChance = monsterWinProbability(context.player.might + ownSupport, monster.might);
    const oddsText = `Your chance to win if you fight: ${Math.round(winChance * 100)}% (ignoring item/follower bonuses and possible support from other players).`;
    situationText = `Your champion${context.championId} at ${positionText} faces a ${monster.name} (might ${monster.might}, reward: ${monster.fame} fame + ${formatResources(monster.resources)}). ${ownStrengthText} ${oddsText} `;
  }

  // Create decision context for fight/flee choice
  const decisionContext: DecisionContext = {
    description: `${situationText}Choose action for ${context.combatType} combat:`,
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

  // Ask player to decide. If the agent fails (e.g. AI API outage), default to fighting
  // rather than aborting mid-combat and leaving enemy knights co-located on the tile.
  let decision: Decision;
  try {
    decision = await playerAgent.makeDecision(context.gameState, gameLog, decisionContext, thinkingLogger);
  } catch (error) {
    logFn("combat", `${context.player.name}'s champion${context.championId}'s fight/flee decision failed (${error instanceof Error ? error.message : String(error)}) - defaulting to fight`);
    decision = { choice: "fight" };
  }

  if (decision.choice === "fight") {
    return {
      attemptedFlee: false,
      reasoning: decision.reasoning || "Chose to fight"
    };
  }

  // Player chose to flee - roll for outcome
  const fleeRoll = rollD3();
  logFn("combat", `${context.player.name}'s champion${context.championId} attempts to flee, rolled [${fleeRoll}]`);

  if (fleeRoll === 1) {
    // Failure - combat proceeds normally
    logFn("combat", `${context.player.name}'s flee attempt failed, combat proceeds`);
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
      logFn("combat", `${context.player.name}'s champion${context.championId} fled to closest owned tile at (${destination.row}, ${destination.col})`);
    } else {
      destination = context.player.homePosition;
      logFn("combat", `${context.player.name}'s champion${context.championId} fled to home tile (no owned tiles available)`);
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
  logFn("combat", `${context.player.name}'s champion${context.championId} fled to home tile without loss`);

  return {
    attemptedFlee: true,
    fleeSuccessful: true,
    destination: context.player.homePosition,
    reasoning: decision.reasoning || "Fled to home"
  };
}
