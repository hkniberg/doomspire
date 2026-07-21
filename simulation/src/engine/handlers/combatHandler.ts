import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { CarriableItem, Champion, Decision, DecisionContext, DecisionOption, GameLogEntry, Monster, NON_COMBAT_TILES, Player, ResourceType, Tile } from "@/lib/types";
import { formatResources } from "@/lib/utils";
import { PlayerAgent } from "@/players/PlayerAgent";
import { canChampionCarryMoreItems, getItemSlotSize, hasTraderItem } from "@/players/PlayerUtils";
import { FleeContext, handleFleeDecision } from "./fleeHandler";

export type GetPlayerAgent = (playerName: string) => PlayerAgent | undefined;

/**
 * Roll a D3 (returns 1, 2, or 3 with equal probability like the game rules)
 */
function rollD3(): number {
  const outcomes = [1, 1, 2, 2, 3, 3];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

/**
 * Roll 2D3 and return the individual dice and total
 */
function roll2D3(): { dice: [number, number]; total: number } {
  const d1 = rollD3();
  const d2 = rollD3();
  return { dice: [d1, d2], total: d1 + d2 };
}

/**
 * Remove items that break after combat
 */
function removeBrokenItems(champion: Champion | undefined, itemsToRemove: CarriableItem[], logFn: (type: string, content: string) => void, championDescription: string = "champion"): void {
  if (itemsToRemove.length > 0 && champion) {
    // Remove broken items
    for (const brokenItem of itemsToRemove) {
      const itemIndex = champion.items.indexOf(brokenItem);
      if (itemIndex !== -1) {
        champion.items.splice(itemIndex, 1);
        const itemName = brokenItem.treasureCard?.name || brokenItem.traderItem?.name || 'Unknown Item';
        logFn("combat", `${itemName} breaks and is removed from ${championDescription}'s inventory`);
      }
    }
  }
}

/**
 * Whether a champion carries an "underdog shield" (Porcupine or Hedgehog).
 * When both sides of a PVP battle carry one, the shields bristle at each other and cancel out.
 */
export function hasUnderdogShield(champion: Champion | undefined): boolean {
  if (!champion) return false;
  return champion.items.some(
    (item) => item.treasureCard?.id === "porcupine" || item.traderItem?.id === "the-hedgehog",
  );
}

function championHasFollower(champion: Champion | undefined, followerId: string): boolean {
  if (!champion) return false;
  return champion.followers.some((f) => f.id === followerId);
}

export function championHasTreasureItem(champion: Champion | undefined, treasureId: string): boolean {
  if (!champion) return false;
  return champion.items.some((item) => item.treasureCard?.id === treasureId);
}

interface CombatBonusContext {
  isPvp: boolean;
  isDragonFight: boolean;
  monster?: Monster; // For monster-type-specific items (spear, trollsbane)
}

/**
 * Compute the combat might bonus from a champion's items and followers (excluding underdog shields,
 * which are evaluated separately against the full combat totals).
 *
 * Automatic bonuses always apply. Items/followers with a cost or trade-off are offered as decisions
 * to the player agent (or used automatically if no agent is available).
 */
async function computeCombatBonuses(
  champion: Champion | undefined,
  player: Player,
  context: CombatBonusContext,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameState?: GameState,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<{ mightBonus: number; itemsToRemove: CarriableItem[] }> {
  let mightBonus = 0;
  const itemsToRemove: CarriableItem[] = [];

  if (!champion) {
    return { mightBonus, itemsToRemove };
  }

  // Automatic item bonuses
  for (const item of champion.items) {
    if (item.combatBonus) {
      mightBonus += item.combatBonus;
      const itemName = item.treasureCard?.name || item.traderItem?.name || 'Unknown Item';
      logFn("combat", `${itemName} provides +${item.combatBonus} might`);
    }

    // Löng Swörd (always applies, doesn't break)
    if (item.treasureCard?.id === "long-sword") {
      mightBonus += 2;
      logFn("combat", `Löng Swörd provides +2 might`);
    }

    // The one ring (+2 might, always applies)
    if (item.treasureCard?.id === "the-one-ring") {
      mightBonus += 2;
      logFn("combat", `The one ring provides +2 might`);
    }

    // The black blade (-1 might, always applies while carried)
    if (item.treasureCard?.id === "the-black-blade") {
      mightBonus -= 1;
      logFn("combat", `The black blade drains -1 might`);
    }

    // Dragonsbane ring (only vs dragon, no downside - use automatically)
    if (item.treasureCard?.id === "dragonsbane-ring" && context.isDragonFight) {
      mightBonus += 3;
      logFn("combat", `Dragonsbane Ring activated automatically: +3 might (vs dragon)`);
    }

    // Spear (+1 vs beasts)
    if (item.traderItem?.id === "spear" && context.monster?.monsterType === "beast") {
      mightBonus += 1;
      logFn("combat", `Spear provides +1 might against ${context.monster.name} (beast)`);
    }
  }

  // Automatic follower bonuses
  if (championHasFollower(champion, "angry-dog")) {
    mightBonus += 1;
    logFn("combat", `Angry dog follower provides +1 might`);
  }
  if (championHasFollower(champion, "witch")) {
    const witchRoll = rollD3();
    const witchBonus = witchRoll === 1 ? -1 : witchRoll === 2 ? 1 : 2;
    mightBonus += witchBonus;
    logFn("combat", `Witch follower rolls [${witchRoll}]: ${witchBonus >= 0 ? "+" : ""}${witchBonus} might`);
  }

  // Items/followers with a cost or trade-off - require player decisions
  const decisions: Array<{
    name: string;
    effect: string;
    mightBonus: number;
    apply: () => void;
  }> = [];

  for (const item of champion.items) {
    // Rusty sword (breaks after use)
    if (item.treasureCard?.id === "rusty-sword") {
      decisions.push({
        name: "Rusty Sword",
        effect: "+2 might (breaks after combat)",
        mightBonus: 2,
        apply: () => itemsToRemove.push(item),
      });
    }

    // Trollsbane (pay 1 fame for +2 might vs trolls)
    if (item.treasureCard?.id === "trollsbane" && context.monster?.monsterType === "troll" && player.fame >= 1) {
      decisions.push({
        name: "Trollsbane",
        effect: "+2 might vs troll (costs 1 fame)",
        mightBonus: 2,
        apply: () => { player.fame -= 1; },
      });
    }

    // Robe of the Salamander (burn 3 wood for +2 might)
    if (item.traderItem?.id === "robe-of-the-salamander" && player.resources.wood >= 3) {
      decisions.push({
        name: "Robe of the Salamander",
        effect: "+2 might (burns 3 wood)",
        mightBonus: 2,
        apply: () => { player.resources.wood -= 3; },
      });
    }

    // The black blade: may sacrifice a follower for +5 might
    if (item.treasureCard?.id === "the-black-blade" && champion.followers.length > 0) {
      const follower = champion.followers[0];
      decisions.push({
        name: "The black blade",
        effect: `+5 might (sacrifices follower ${follower.name})`,
        mightBonus: 5,
        apply: () => {
          const index = champion.followers.indexOf(follower);
          if (index !== -1) {
            champion.followers.splice(index, 1);
          }
          logFn("combat", `The black blade consumes ${follower.name}!`);
        },
      });
    }
  }

  // Followers with a cost
  if (championHasFollower(champion, "proud-mercenary") && player.resources.gold >= 3) {
    decisions.push({
      name: "Proud Mercenary",
      effect: "+2 might (costs 3 gold)",
      mightBonus: 2,
      apply: () => { player.resources.gold -= 3; },
    });
  }
  if (championHasFollower(champion, "brawler") && player.resources.food >= 3) {
    decisions.push({
      name: "Brawler",
      effect: "+2 might (costs 3 food)",
      mightBonus: 2,
      apply: () => { player.resources.food -= 3; },
    });
  }

  for (const choice of decisions) {
    let useIt = true;

    if (playerAgent && gameState && gameLog) {
      const decisionContext: DecisionContext = {
        description: `Use ${choice.name}? (${choice.effect})`,
        options: [
          { id: "yes", description: `Yes, use ${choice.name}` },
          { id: "no", description: `No, save ${choice.name} for later` }
        ]
      };

      try {
        const decision = await playerAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
        useIt = decision.choice === "yes";
      } catch (error) {
        logFn("combat", `Error asking about ${choice.name}, using automatically`);
        useIt = true;
      }
    }

    if (useIt) {
      mightBonus += choice.mightBonus;
      choice.apply();
      logFn("combat", `${choice.name} activated: ${choice.effect}`);
    } else {
      logFn("combat", `${choice.name} saved for later use`);
    }
  }

  return { mightBonus, itemsToRemove };
}

/**
 * Evaluate underdog shields (Porcupine/Hedgehog) against the opponent's full combat total
 * (dice + might + support + item/follower bonuses, excluding the shield's own bonus).
 */
function applyUnderdogShields(
  champion: Champion | undefined,
  isPvp: boolean,
  shieldsCancel: boolean,
  ownTotalBeforeShields: number,
  opponentFullTotal: number,
  logFn: (type: string, content: string) => void
): number {
  if (!champion) return 0;

  let bonus = 0;
  const opponentHasHigherTotal = opponentFullTotal > ownTotalBeforeShields;

  for (const item of champion.items) {
    if (item.treasureCard?.id === "porcupine") {
      if (shieldsCancel) {
        logFn("combat", `Porcupine Shield cancelled: both knights carry an underdog shield`);
      } else if (opponentHasHigherTotal) {
        bonus += 2;
        logFn("combat", `Porcupine Shield activated: +2 might (opponent has a higher combat total)`);
      }
    }

    if (item.traderItem?.id === "the-hedgehog" && isPvp) {
      if (shieldsCancel) {
        logFn("combat", `The Hedgehog cancelled: both knights carry an underdog shield`);
      } else if (opponentHasHigherTotal) {
        bonus += 1;
        logFn("combat", `The Hedgehog activated: +1 might (opponent has a higher combat total)`);
      }
    }
  }

  return bonus;
}

/**
 * Ask other players with support units in range whether they want to support a combatant.
 * Support is announced after the dice roll. Max one support (+2) per player per battle.
 *
 * Simulator deviation: this is a one-shot poll of each eligible player, with no negotiation.
 *
 * @param sides The choices available (e.g. attacker/defender, or champion/dragon)
 * @returns Total support bonus per side id
 */
async function gatherThirdPartySupport(
  gameState: GameState,
  position: { row: number; col: number },
  excludeNames: string[],
  sides: Array<{ id: string; label: string }>,
  getPlayerAgent: GetPlayerAgent | undefined,
  gameLog: readonly GameLogEntry[] | undefined,
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<Record<string, number>> {
  const supportBySide: Record<string, number> = {};
  for (const side of sides) {
    supportBySide[side.id] = 0;
  }

  if (!getPlayerAgent || !gameLog) {
    return supportBySide;
  }

  const candidates = gameState.getOtherPlayersWithSupportInRange(position, excludeNames);

  for (const candidateName of candidates) {
    const agent = getPlayerAgent(candidateName);
    if (!agent) continue;

    const options: DecisionOption[] = [
      ...sides.map((side) => ({ id: side.id, description: side.label })),
      { id: "none", description: "Do not support anyone" }
    ];

    const decisionContext: DecisionContext = {
      description: `${candidateName}: You have units in range of a battle at (${position.row}, ${position.col}). You may support one side with +${GameSettings.COMBAT_SUPPORT_BONUS} might.`,
      options
    };

    try {
      const decision = await agent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
      if (decision.choice !== "none" && decision.choice in supportBySide) {
        supportBySide[decision.choice] += GameSettings.COMBAT_SUPPORT_BONUS;
        const sideLabel = sides.find((s) => s.id === decision.choice)?.label || decision.choice;
        logFn("combat", `${candidateName} supports: ${sideLabel} (+${GameSettings.COMBAT_SUPPORT_BONUS})`);

        // Fairy godmother follower: gain 1 fame every time your champion supports another player in battle
        const supporter = gameState.getPlayer(candidateName);
        if (supporter && supporter.champions.some((c) => championHasFollower(c, "fairy-godmother"))) {
          supporter.fame += 1;
          logFn("event", `${candidateName}'s fairy godmother is delighted: +1 fame for supporting another player`);
        }
      }
    } catch (error) {
      // If the agent fails, they simply don't support anyone
    }
  }

  return supportBySide;
}

export interface CombatResult {
  combatOccurred: boolean;
  victory?: boolean;
  defeat?: boolean;
  combatDetails?: string;
}

export interface DragonEncounterResult {
  encounterOccurred: boolean;
  impressed?: boolean; // Whether the player impressed the dragon this visit
  impressionMethod?: string; // fame / gold / economy / combat / dragon's egg / rings
  gameWon?: boolean; // Player reached the required number of impressions (or the ring trifecta)
  championEaten?: boolean; // Knight lost to the dragon and was eaten
  combatDetails?: string;
}

/**
 * Count the number of resource tiles owned by a player (home tile counts as a resource tile).
 * Used for PVP looting: the winner may steal ceil(count / 2) resources.
 */
function countOwnedResourceTiles(gameState: GameState, playerName: string): number {
  return gameState.board.findTiles(
    (tile) => tile.claimedBy === playerName && (tile.tileType === "resource" || tile.tileType === "home")
  ).length;
}

/**
 * Loot a defeated champion after PVP combat, per the rules:
 * - Steal 1 item from the defeated knight's inventory (if any can be stolen and there is space)
 * - Steal ceil(ownedResourceTiles / 2) resources from the defeated player
 * The winner chooses what to take. Exception: if the loser carries a Padded Helmet,
 * the LOSER chooses what is taken instead.
 */
async function lootDefeatedChampion(
  gameState: GameState,
  winnerPlayer: Player,
  winnerChampion: Champion,
  loserPlayer: Player,
  loserChampion: Champion,
  winnerAgent: PlayerAgent | undefined,
  loserAgent: PlayerAgent | undefined,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<string> {
  const lootDescriptions: string[] = [];

  // Padded helmet: the defeated player chooses what is looted
  const loserHasPaddedHelmet = hasTraderItem(loserPlayer, "padded-helmet");
  const deciderAgent = loserHasPaddedHelmet ? (loserAgent || winnerAgent) : winnerAgent;
  const deciderLabel = loserHasPaddedHelmet ? `${loserPlayer.name} (padded helmet: loser chooses)` : winnerPlayer.name;

  const makeChoice = async (decisionContext: DecisionContext): Promise<Decision> => {
    if (!deciderAgent) {
      // No agent available: pick the first option
      return { choice: decisionContext.options[0].id, reasoning: "Automatic choice (no agent available)" };
    }
    try {
      return await deciderAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
    } catch (error) {
      return { choice: decisionContext.options[0].id, reasoning: "Automatic choice (agent error)" };
    }
  };

  // 1. Steal 1 item (if possible)
  const stealableItems = loserChampion.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.stuck && !item.unstealable && canChampionCarryMoreItems(winnerChampion, getItemSlotSize(item)));

  if (stealableItems.length > 0) {
    const itemOptions: DecisionOption[] = stealableItems.map(({ item, index }) => {
      const itemName = item.treasureCard?.name || item.traderItem?.name || "Unknown Item";
      return { id: `item_${index}`, description: `Steal item: ${itemName}` };
    });
    itemOptions.push({ id: "no_item", description: "Do not steal an item" });

    const decision = await makeChoice({
      description: `${deciderLabel}: choose which item is looted from the defeated knight (1 item may be stolen):`,
      options: itemOptions
    });

    if (decision.choice.startsWith("item_")) {
      const itemIndex = parseInt(decision.choice.split("_")[1]);
      if (itemIndex >= 0 && itemIndex < loserChampion.items.length) {
        const lootedItem = loserChampion.items[itemIndex];
        loserChampion.items.splice(itemIndex, 1);
        winnerChampion.items.push(lootedItem);
        const itemName = lootedItem.treasureCard?.name || lootedItem.traderItem?.name || "Unknown Item";
        lootDescriptions.push(`stole ${itemName}`);
      }
    }
  }

  // 2. Steal resources: ceil(ownedResourceTiles / 2), one at a time
  const resourceStealCount = Math.ceil(countOwnedResourceTiles(gameState, loserPlayer.name) / 2);
  let resourcesStolen: Partial<Record<ResourceType, number>> = {};

  for (let i = 0; i < resourceStealCount; i++) {
    const availableTypes = (["food", "wood", "ore", "gold"] as ResourceType[]).filter(
      (type) => loserPlayer.resources[type] > 0
    );
    if (availableTypes.length === 0) break;

    let chosenType: ResourceType;
    if (availableTypes.length === 1) {
      chosenType = availableTypes[0];
    } else {
      const resourceOptions: DecisionOption[] = availableTypes.map((type) => ({
        id: type,
        description: `Steal 1 ${type} (${loserPlayer.name} has ${loserPlayer.resources[type]})`
      }));
      const decision = await makeChoice({
        description: `${deciderLabel}: choose resource ${i + 1} of ${resourceStealCount} to be looted:`,
        options: resourceOptions
      });
      chosenType = (availableTypes.includes(decision.choice as ResourceType)
        ? decision.choice
        : availableTypes[0]) as ResourceType;
    }

    loserPlayer.resources[chosenType] -= 1;
    winnerPlayer.resources[chosenType] += 1;
    resourcesStolen[chosenType] = (resourcesStolen[chosenType] || 0) + 1;
  }

  const stolenParts = Object.entries(resourcesStolen).map(([type, amount]) => `${amount} ${type}`);
  if (stolenParts.length > 0) {
    lootDescriptions.push(`stole ${stolenParts.join(", ")}`);
  }

  if (lootDescriptions.length === 0) {
    return "nothing to loot";
  }

  const helmetNote = loserHasPaddedHelmet ? " (loser chose, padded helmet)" : "";
  return `${winnerPlayer.name} ${lootDescriptions.join(" and ")}${helmetNote}`;
}

/**
 * Handle champion vs champion combat.
 * The attacker (current player) moved onto the defender's tile; the defender may attempt to flee.
 */
export async function resolveChampionVsChampionCombat(
  gameState: GameState,
  tile: Tile,
  attackingPlayer: Player,
  attackingChampionId: number,
  playerAgent: PlayerAgent,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<CombatResult> {
  const opposingChampions = gameState.getOpposingChampionsAtPosition(attackingPlayer.name, tile.position);

  // No combat if no opposing champions or on non-combat tiles
  if (opposingChampions.length === 0 || (tile.tileType && NON_COMBAT_TILES.includes(tile.tileType))) {
    return { combatOccurred: false };
  }

  // Ceasefire fate card: no PVP combat this round
  if (gameState.fateEffects.noPvpCombat) {
    logFn("combat", `Ceasefire is in effect: no PVP combat this round`);
    return { combatOccurred: false };
  }

  const opposingChampion = opposingChampions[0];
  const defendingPlayer = gameState.getPlayer(opposingChampion.playerName);
  if (!defendingPlayer) {
    throw new Error(`Opposing player ${opposingChampion.playerName} not found`);
  }

  const attackingChampion = gameState.getChampion(attackingPlayer.name, attackingChampionId);
  if (!attackingChampion) {
    throw new Error(`Attacking champion ${attackingChampionId} not found`);
  }

  // The defender (who was attacked) may attempt to flee. The attacker chose this combat and cannot flee.
  const defendingPlayerAgent = getPlayerAgent ? getPlayerAgent(defendingPlayer.name) : undefined;
  if (defendingPlayerAgent) {
    const defenderFleeContext: FleeContext = {
      combatType: 'champion',
      canFlee: true, // Defender was attacked and may attempt to flee
      gameState,
      player: defendingPlayer,
      championId: opposingChampion.id,
      tile,
      attackerPlayer: attackingPlayer,
      attackerChampionId: attackingChampionId
    };

    const defenderFleeResult = await handleFleeDecision(defenderFleeContext, defendingPlayerAgent, gameLog, logFn, thinkingLogger);

    if (defenderFleeResult.attemptedFlee && defenderFleeResult.fleeSuccessful) {
      // Defender fled successfully, no combat occurs
      return {
        combatOccurred: false,
        combatDetails: `${defendingPlayer.name}'s champion fled from combat with ${attackingPlayer.name}'s champion`
      };
    }

    if (defenderFleeResult.attemptedFlee && !defenderFleeResult.fleeSuccessful) {
      logFn("combat", "Defender's flee attempt failed, proceeding with combat");
    }
  }

  // Roll dice for both sides (2D3 each)
  let attackerDice = roll2D3();
  let defenderDice = roll2D3();
  logFn("combat", `${attackingPlayer.name} rolled [${attackerDice.dice[0]}+${attackerDice.dice[1]}] = ${attackerDice.total}`);
  logFn("combat", `${defendingPlayer.name} rolled [${defenderDice.dice[0]}+${defenderDice.dice[1]}] = ${defenderDice.total}`);

  // Own support (automatic), announced after the roll
  let attackerSupport = gameState.getCombatSupport(attackingPlayer.name, tile.position, attackingChampion.id);
  let defenderSupport = gameState.getCombatSupport(defendingPlayer.name, tile.position, opposingChampion.id);
  if (attackerSupport > 0) logFn("combat", `${attackingPlayer.name} receives +${attackerSupport} support from own units`);
  if (defenderSupport > 0) logFn("combat", `${defendingPlayer.name} receives +${defenderSupport} support from own units`);

  // Third-party support (other players with units in range may support either side)
  const thirdPartySupport = await gatherThirdPartySupport(
    gameState,
    tile.position,
    [attackingPlayer.name, defendingPlayer.name],
    [
      { id: "attacker", label: `Support ${attackingPlayer.name} (attacker)` },
      { id: "defender", label: `Support ${defendingPlayer.name} (defender)` }
    ],
    getPlayerAgent,
    gameLog,
    logFn,
    thinkingLogger
  );
  attackerSupport += thirdPartySupport["attacker"] || 0;
  defenderSupport += thirdPartySupport["defender"] || 0;

  // Item/follower bonuses (decided once, after seeing the dice and support)
  const underdogShieldsCancel = hasUnderdogShield(attackingChampion) && hasUnderdogShield(opposingChampion);

  const attackerBonuses = await computeCombatBonuses(
    attackingChampion, attackingPlayer, { isPvp: true, isDragonFight: false },
    logFn, playerAgent, gameState, gameLog, thinkingLogger
  );
  const defenderBonuses = await computeCombatBonuses(
    opposingChampion, defendingPlayer, { isPvp: true, isDragonFight: false },
    logFn, defendingPlayerAgent, gameState, gameLog, thinkingLogger
  );

  // Resolve combat, rerolling dice on ties (support and item decisions stay fixed)
  let attackerTotal: number;
  let defenderTotal: number;

  while (true) {
    const attackerBeforeShields = attackingPlayer.might + attackerDice.total + attackerSupport + attackerBonuses.mightBonus;
    const defenderBeforeShields = defendingPlayer.might + defenderDice.total + defenderSupport + defenderBonuses.mightBonus;

    const attackerShieldBonus = applyUnderdogShields(
      attackingChampion, true, underdogShieldsCancel, attackerBeforeShields, defenderBeforeShields, logFn
    );
    const defenderShieldBonus = applyUnderdogShields(
      opposingChampion, true, underdogShieldsCancel, defenderBeforeShields, attackerBeforeShields, logFn
    );

    attackerTotal = attackerBeforeShields + attackerShieldBonus;
    defenderTotal = defenderBeforeShields + defenderShieldBonus;

    if (attackerTotal !== defenderTotal) {
      break;
    }

    logFn("combat", `Combat tied (${attackerTotal} vs ${defenderTotal}), rerolling...`);
    attackerDice = roll2D3();
    defenderDice = roll2D3();
    logFn("combat", `${attackingPlayer.name} rerolled [${attackerDice.dice[0]}+${attackerDice.dice[1]}] = ${attackerDice.total}`);
    logFn("combat", `${defendingPlayer.name} rerolled [${defenderDice.dice[0]}+${defenderDice.dice[1]}] = ${defenderDice.total}`);
  }

  const attackerWins = attackerTotal > defenderTotal;

  // Remove items that break after combat (win or lose)
  removeBrokenItems(attackingChampion, attackerBonuses.itemsToRemove, logFn, "attacker's");
  removeBrokenItems(opposingChampion, defenderBonuses.itemsToRemove, logFn, "defender's");

  if (attackerWins) {
    // Attacker won - award fame and send defender home (no healing cost since they get looted)
    attackingPlayer.fame += GameSettings.CHAMPION_VS_CHAMPION_FAME_AWARD;
    opposingChampion.position = defendingPlayer.homePosition;

    const lootInfo = await lootDefeatedChampion(
      gameState,
      attackingPlayer, attackingChampion,
      defendingPlayer, opposingChampion,
      playerAgent, defendingPlayerAgent,
      gameLog, logFn, thinkingLogger
    );

    const fullCombatDetails = `Defeated ${defendingPlayer.name}'s champion (${attackerTotal} vs ${defenderTotal}), who went home. Loot: ${lootInfo}`;
    logFn("combat", fullCombatDetails);

    // Track combat statistics
    if (attackingPlayer.statistics) {
      attackingPlayer.statistics.championVsChampionWins += 1;
    }
    if (defendingPlayer.statistics) {
      defendingPlayer.statistics.championVsChampionLosses += 1;
    }

    return {
      combatOccurred: true,
      victory: true,
      combatDetails: fullCombatDetails
    };
  } else {
    // Attacker lost - goes home and gets looted by the defender
    const attackerChampionForLoot = gameState.getChampion(attackingPlayer.name, attackingChampionId);

    defendingPlayer.fame += GameSettings.CHAMPION_VS_CHAMPION_FAME_AWARD;

    let lootInfo = "nothing to loot";
    if (attackerChampionForLoot) {
      lootInfo = await lootDefeatedChampion(
        gameState,
        defendingPlayer, opposingChampion,
        attackingPlayer, attackerChampionForLoot,
        defendingPlayerAgent, playerAgent,
        gameLog, logFn, thinkingLogger
      );
    }

    const fullCombatDetails = `was defeated by ${defendingPlayer.name}'s champion (${attackerTotal} vs ${defenderTotal}). Loot: ${lootInfo}`;

    // Send attacking champion home (no healing cost for champion vs champion combat)
    gameState.moveChampionToHome(attackingPlayer.name, attackingChampionId);
    logFn("combat", `${fullCombatDetails}, went home`);

    // Track combat statistics
    if (defendingPlayer.statistics) {
      defendingPlayer.statistics.championVsChampionWins += 1;
    }
    if (attackingPlayer.statistics) {
      attackingPlayer.statistics.championVsChampionLosses += 1;
    }

    return {
      combatOccurred: true,
      defeat: true,
      combatDetails: fullCombatDetails
    };
  }
}

/**
 * Core champion vs monster combat logic (shared between immediate and tile-based combat)
 */
async function performChampionVsMonsterCombat(
  gameState: GameState,
  monster: Monster,
  player: Player,
  championId: number,
  position: { row: number; col: number },
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<{
  championWins: boolean;
  combatDetails: string;
  itemsToRemove: CarriableItem[];
}> {
  const champion = gameState.getChampion(player.name, championId);

  // Roll dice for champion vs monster battle
  const championRoll = rollD3();
  logFn("combat", `Champion rolled [${championRoll}] for combat with ${monster.name}`);

  // Own support (automatic)
  let supportBonus = gameState.getCombatSupport(player.name, position, championId);
  if (supportBonus > 0) {
    logFn("combat", `Combat support: +${supportBonus} might from own units in range`);
  }

  // Third-party support (other players may choose to support the champion; monsters cannot receive support)
  const thirdPartySupport = await gatherThirdPartySupport(
    gameState,
    position,
    [player.name],
    [{ id: "champion", label: `Support ${player.name} against ${monster.name}` }],
    getPlayerAgent,
    gameLog,
    logFn,
    thinkingLogger
  );
  supportBonus += thirdPartySupport["champion"] || 0;

  // Item/follower bonuses (decided after seeing the dice roll)
  const { mightBonus, itemsToRemove } = await computeCombatBonuses(
    champion,
    player,
    { isPvp: false, isDragonFight: false, monster },
    logFn,
    playerAgent,
    gameState,
    gameLog,
    thinkingLogger
  );

  // Underdog shield (Porcupine works vs monsters; monsters carry no shields)
  const totalBeforeShields = player.might + championRoll + supportBonus + mightBonus;
  const shieldBonus = applyUnderdogShields(champion, false, false, totalBeforeShields, monster.might, logFn);

  const championTotal = totalBeforeShields + shieldBonus;
  const championWins = championTotal >= monster.might;

  const combatDetails = championWins
    ? `Defeated ${monster.name} (${championTotal} vs ${monster.might})`
    : `Fought ${monster.name}, but was defeated (${championTotal} vs ${monster.might})`;

  return { championWins, combatDetails, itemsToRemove };
}

/**
 * Handle immediate combat encounters without placing monsters on tiles (used for events)
 */
export async function resolveImmediateCombat(
  gameState: GameState,
  monster: Monster,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void
): Promise<CombatResult> {
  const champion = gameState.getChampion(player.name, championId);
  const position = champion ? champion.position : player.homePosition;

  const { championWins, combatDetails, itemsToRemove } = await performChampionVsMonsterCombat(
    gameState, monster, player, championId, position, logFn, undefined, undefined, undefined, undefined
  );

  if (championWins) {
    // Champion won - award fame and resources (monster not placed on board)
    const fameAwarded = monster.fame || 0;
    player.fame += fameAwarded;
    player.resources.food += monster.resources.food;
    player.resources.wood += monster.resources.wood;
    player.resources.ore += monster.resources.ore;
    player.resources.gold += monster.resources.gold;

    const fullCombatDetails = `${combatDetails}, gained ${fameAwarded} fame and got ${formatResources(monster.resources)}`;
    logFn("combat", fullCombatDetails);

    // Remove items that break after combat
    removeBrokenItems(champion, itemsToRemove, logFn);

    // Track combat statistics
    if (player.statistics) {
      player.statistics.championVsMonsterWins += 1;
    }

    return {
      combatOccurred: true,
      victory: true,
      combatDetails: fullCombatDetails
    };
  } else {
    // Champion lost - apply defeat effects immediately
    removeBrokenItems(champion, itemsToRemove, logFn);

    // Apply defeat effects internally
    await applyChampionDefeat(gameState, player, championId, combatDetails, logFn);

    // Track combat statistics
    if (player.statistics) {
      player.statistics.championVsMonsterLosses += 1;
    }

    return {
      combatOccurred: true,
      defeat: true,
      combatDetails
    };
  }
}

/**
 * Handle champion vs monster combat.
 * The champion may always attempt to flee from monster combat (per the rules).
 */
export async function resolveChampionVsMonsterCombat(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<CombatResult> {
  if (!tile.monster) {
    return { combatOccurred: false };
  }

  const monster = tile.monster;
  const champion = gameState.getChampion(player.name, championId);

  // Handle fleeing decision if applicable and we have the required parameters
  if (playerAgent && gameLog) {
    const fleeContext: FleeContext = {
      combatType: 'monster',
      canFlee: true,
      gameState,
      player,
      championId,
      tile
    };

    const fleeResult = await handleFleeDecision(fleeContext, playerAgent, gameLog, logFn, thinkingLogger);

    if (fleeResult.attemptedFlee && fleeResult.fleeSuccessful) {
      // Fleeing was successful, no combat occurs
      return {
        combatOccurred: false,
        combatDetails: `Champion fled from combat with ${monster.name}`
      };
    }

    // If flee was attempted but failed, or player chose to fight, continue with combat
    if (fleeResult.attemptedFlee && !fleeResult.fleeSuccessful) {
      logFn("combat", "Flee attempt failed, proceeding with combat");
    }
  }

  const { championWins, combatDetails, itemsToRemove } = await performChampionVsMonsterCombat(
    gameState, monster, player, championId, tile.position, logFn, playerAgent, gameLog, thinkingLogger, getPlayerAgent
  );

  if (championWins) {
    // Champion won - award fame and resources, remove monster
    const fameAwarded = monster.fame || 0;
    player.fame += fameAwarded;
    player.resources.food += monster.resources.food;
    player.resources.wood += monster.resources.wood;
    player.resources.ore += monster.resources.ore;
    player.resources.gold += monster.resources.gold;

    // Remove monster from tile
    tile.monster = undefined;

    const fullCombatDetails = `${combatDetails}, gained ${fameAwarded} fame and got ${formatResources(monster.resources)}`;
    logFn("combat", fullCombatDetails);

    // Remove items that break after combat
    removeBrokenItems(champion, itemsToRemove, logFn);

    // Track combat statistics
    if (player.statistics) {
      player.statistics.championVsMonsterWins += 1;
    }

    return {
      combatOccurred: true,
      victory: true,
      combatDetails: fullCombatDetails
    };
  } else {
    // Champion lost - monster stays on tile, apply defeat effects immediately
    removeBrokenItems(champion, itemsToRemove, logFn);

    // Apply defeat effects internally
    await applyChampionDefeat(gameState, player, championId, combatDetails, logFn, playerAgent, gameLog, thinkingLogger);

    // Track combat statistics
    if (player.statistics) {
      player.statistics.championVsMonsterLosses += 1;
    }

    return {
      combatOccurred: true,
      defeat: true,
      combatDetails
    };
  }
}

/**
 * Take one treasure stack from the dragon's hoard (if any remain) and give it to the player.
 */
function takeTreasureStack(tile: Tile, player: Player, logFn: (type: string, content: string) => void): boolean {
  if (!tile.treasureStacks || tile.treasureStacks.length === 0) {
    logFn("event", `The dragon's treasure hoard is empty - no reward remains.`);
    return false;
  }

  const stack = tile.treasureStacks.pop()!;
  player.resources.food += stack.food;
  player.resources.wood += stack.wood;
  player.resources.ore += stack.ore;
  player.resources.gold += stack.gold;
  logFn("event", `${player.name} takes a treasure stack from the dragon's hoard: ${formatResources(stack)}. ${tile.treasureStacks.length} stack(s) remain.`);
  return true;
}

/**
 * Mark a dragon impression for the player and handle the reward.
 * Returns true if this impression wins the game.
 */
function registerDragonImpression(
  gameState: GameState,
  tile: Tile,
  player: Player,
  method: string,
  logFn: (type: string, content: string) => void
): boolean {
  player.dragonImpressions += 1;
  player.impressedDragonThisRound = true;

  logFn("victory", `Dragon Impressed! ${player.name} impressed the dragon (${method}). Impressions: ${player.dragonImpressions}/${GameSettings.DRAGON_IMPRESSIONS_TO_WIN}`);

  if (player.dragonImpressions >= GameSettings.DRAGON_IMPRESSIONS_TO_WIN) {
    return true;
  }

  // Reward: take one treasure stack if any remain. The knight stays at Doomspire.
  takeTreasureStack(tile, player, logFn);
  return false;
}

/**
 * Handle a champion vs dragon encounter at Doomspire.
 *
 * The champion attempts to impress the dragon:
 * - Automatically with 17+ fame, 12+ gold, or 4+ starred resource tiles
 * - With special treasures (Dragon's Egg, the ring pair)
 * - Or by defeating the dragon in combat (2D3 each, like knight-to-knight combat; fleeing is impossible)
 *
 * Failing to impress means the knight is eaten.
 * A player can impress the dragon at most once per round.
 */
export async function resolveChampionVsDragonEncounter(
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<DragonEncounterResult> {
  if (tile.tileType !== "doomspire") {
    return { encounterOccurred: false };
  }

  const champion = gameState.getChampion(player.name, championId);
  const fateEffects = gameState.fateEffects;

  // Dragon Off Hunting fate card: the dragon is absent. No impressing, but treasure may be taken.
  if (fateEffects.dragonAbsent) {
    logFn("event", `The dragon is off hunting - Doomspire is unguarded!`);
    takeTreasureStack(tile, player, logFn);
    return { encounterOccurred: true };
  }

  // A player can impress the dragon at most once per round
  if (player.impressedDragonThisRound) {
    logFn("event", `${player.name} has already impressed the dragon this round. The dragon dozes off.`);
    return { encounterOccurred: true };
  }

  // Ring trifecta: one ring + second ring + mysterious ring on the same knight = instant win
  if (champion &&
    championHasTreasureItem(champion, "the-one-ring") &&
    championHasTreasureItem(champion, "the-second-ring") &&
    championHasTreasureItem(champion, "mysterious-ring")) {
    logFn("victory", `${player.name}'s champion carries all three rings and absorbs the dragon's essence, taking its place as the new ruler of Doomspire!`);
    player.dragonImpressions = GameSettings.DRAGON_IMPRESSIONS_TO_WIN;
    return { encounterOccurred: true, impressed: true, impressionMethod: "ring trifecta", gameWon: true };
  }

  // Check automatic (non-combat) impression conditions
  // Dragon Sleeping fate card: only combat can impress this round
  let impressionMethod: string | undefined;
  if (!fateEffects.dragonCombatImpressionOnly) {
    if (player.fame >= GameSettings.VICTORY_FAME_THRESHOLD) {
      impressionMethod = `${GameSettings.VICTORY_FAME_THRESHOLD}+ fame`;
    } else if (player.resources.gold >= GameSettings.VICTORY_GOLD_THRESHOLD) {
      impressionMethod = `${GameSettings.VICTORY_GOLD_THRESHOLD}+ gold`;
    } else if (gameState.getStarredTileCount(player.name) >= GameSettings.VICTORY_STARRED_TILES_THRESHOLD) {
      impressionMethod = `${GameSettings.VICTORY_STARRED_TILES_THRESHOLD}+ starred resource tiles`;
    } else if (champion &&
      championHasTreasureItem(champion, "the-one-ring") &&
      championHasTreasureItem(champion, "the-second-ring")) {
      impressionMethod = "the one ring and the second ring";
    } else if (champion && championHasTreasureItem(champion, "dragons-egg")) {
      // Using the egg consumes it - ask the player (fall back to using it automatically)
      let useEgg = true;
      if (playerAgent && gameLog) {
        const decisionContext: DecisionContext = {
          description: `Return the Dragon's Egg to impress the dragon (the egg is consumed), or keep it and fight the dragon (might ${GameSettings.DRAGON_BASE_MIGHT + (fateEffects.dragonMightModifier || 0)})?`,
          options: [
            { id: "use_egg", description: "Return the Dragon's Egg (guaranteed impression, egg is consumed)" },
            { id: "fight", description: "Keep the egg and fight the dragon" }
          ]
        };
        try {
          const decision = await playerAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
          useEgg = decision.choice === "use_egg";
        } catch (error) {
          useEgg = true;
        }
      }
      if (useEgg) {
        const eggIndex = champion.items.findIndex((item) => item.treasureCard?.id === "dragons-egg");
        if (eggIndex !== -1) {
          champion.items.splice(eggIndex, 1);
        }
        logFn("event", `${player.name} returns the Dragon's Egg to the overjoyed dragon!`);
        impressionMethod = "the Dragon's Egg";
      }
    }
  }

  if (impressionMethod) {
    const gameWon = registerDragonImpression(gameState, tile, player, impressionMethod, logFn);
    return { encounterOccurred: true, impressed: true, impressionMethod, gameWon };
  }

  // Must fight the dragon - fleeing is impossible
  if (player.statistics) {
    player.statistics.dragonEncounters += 1;
  }

  const dragonMight = GameSettings.DRAGON_BASE_MIGHT + (fateEffects.dragonMightModifier || 0);
  if (fateEffects.dragonMightModifier) {
    logFn("combat", `The dragon is sleeping - its might is reduced to ${dragonMight}`);
  }

  // Both sides roll 2D3, like knight-to-knight combat
  let championDice = roll2D3();
  let dragonDice = roll2D3();
  logFn("combat", `${player.name} rolled [${championDice.dice[0]}+${championDice.dice[1]}] = ${championDice.total} vs Dragon's [${dragonDice.dice[0]}+${dragonDice.dice[1]}] = ${dragonDice.total}`);

  // Own support (automatic)
  let championSupport = gameState.getCombatSupport(player.name, tile.position, championId);
  if (championSupport > 0) {
    logFn("combat", `Combat support: +${championSupport} might from own units in range`);
  }

  // Third-party support: other players may support the champion or the dragon
  const thirdPartySupport = await gatherThirdPartySupport(
    gameState,
    tile.position,
    [player.name],
    [
      { id: "champion", label: `Support ${player.name} against the dragon` },
      { id: "dragon", label: `Support the dragon against ${player.name}` }
    ],
    getPlayerAgent,
    gameLog,
    logFn,
    thinkingLogger
  );
  championSupport += thirdPartySupport["champion"] || 0;
  const dragonSupport = thirdPartySupport["dragon"] || 0;

  // Item/follower bonuses (decided after seeing the dice roll)
  const { mightBonus, itemsToRemove } = await computeCombatBonuses(
    champion,
    player,
    { isPvp: false, isDragonFight: true },
    logFn,
    playerAgent,
    gameState,
    gameLog,
    thinkingLogger
  );

  // Resolve, rerolling on ties
  let championTotal: number;
  let dragonTotal: number;

  while (true) {
    const championBeforeShields = player.might + championDice.total + championSupport + mightBonus;
    dragonTotal = dragonMight + dragonDice.total + dragonSupport;

    const shieldBonus = applyUnderdogShields(champion, false, false, championBeforeShields, dragonTotal, logFn);
    championTotal = championBeforeShields + shieldBonus;

    if (championTotal !== dragonTotal) {
      break;
    }

    logFn("combat", `Tied (${championTotal} vs ${dragonTotal}), rerolling...`);
    championDice = roll2D3();
    dragonDice = roll2D3();
    logFn("combat", `${player.name} rerolled [${championDice.dice[0]}+${championDice.dice[1]}] = ${championDice.total} vs Dragon's [${dragonDice.dice[0]}+${dragonDice.dice[1]}] = ${dragonDice.total}`);
  }

  const championWins = championTotal > dragonTotal;

  // Remove items that break after combat (win or lose)
  removeBrokenItems(champion, itemsToRemove, logFn);

  if (!championWins) {
    // Champion was defeated by dragon - they get EATEN (permanently removed from game)
    const combatDetails = `was eaten by the dragon (${championTotal} vs ${dragonTotal})!`;
    logFn("combat", `Champion${championId} ${combatDetails}`);

    // Remove the champion permanently (eaten by dragon), along with items and followers
    const championIndex = player.champions.findIndex(c => c.id === championId);
    if (championIndex !== -1) {
      const eatenChampion = player.champions[championIndex];
      if (eatenChampion.items.length > 0) {
        logFn("combat", `Champion${championId}'s items are lost forever!`);
      }
      if (eatenChampion.followers.length > 0) {
        logFn("combat", `Champion${championId}'s followers are lost forever!`);
      }
      player.champions.splice(championIndex, 1);
    }

    if (player.champions.length === 0) {
      logFn("system", `${player.name} has no knights left, but can keep playing and save up for a new one (1 die per round).`);
    }

    return {
      encounterOccurred: true,
      championEaten: true,
      combatDetails
    };
  } else {
    // Champion won - the dragon is impressed by their might!
    const combatDetails = `Combat Victory! ${player.name} defeated the dragon (${championTotal} vs ${dragonTotal})!`;
    logFn("victory", combatDetails);

    const gameWon = registerDragonImpression(gameState, tile, player, "combat", logFn);

    return {
      encounterOccurred: true,
      impressed: true,
      impressionMethod: "combat",
      gameWon,
      combatDetails
    };
  }
}

/**
 * Handle champion defeat effects (send home and pay healing costs)
 */
export async function applyChampionDefeat(
  gameState: GameState,
  player: Player,
  championId: number,
  defeatContext: string,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<void> {
  // Priestess follower: heals for free after losing a fight against a wild creature
  const champion = gameState.getChampion(player.name, championId);
  const hasPriestess = championHasFollower(champion, "priestess");

  // Send champion home
  gameState.moveChampionToHome(player.name, championId);

  if (hasPriestess) {
    logFn("combat", `${defeatContext}, went home. The Priestess heals the champion for free.`);
    return;
  }

  // Pay healing cost
  await handleHealingCost(player, `${defeatContext}, went home`, logFn, playerAgent, gameState, gameLog, thinkingLogger);
}

/**
 * Handle the healing cost payment after champion defeat
 */
async function handleHealingCost(
  player: Player,
  defeatContext: string,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameState?: GameState,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<void> {
  // Check what resources the player has available
  const availableResources: Array<{ type: ResourceType; name: string; amount: number }> = [];

  if (player.resources.food > 0) {
    availableResources.push({ type: "food", name: "Food", amount: player.resources.food });
  }
  if (player.resources.wood > 0) {
    availableResources.push({ type: "wood", name: "Wood", amount: player.resources.wood });
  }
  if (player.resources.ore > 0) {
    availableResources.push({ type: "ore", name: "Ore", amount: player.resources.ore });
  }
  if (player.resources.gold > 0) {
    availableResources.push({ type: "gold", name: "Gold", amount: player.resources.gold });
  }

  if (availableResources.length === 0) {
    // No resources available - lose fame if possible
    const hadFame = player.fame > 0;
    player.fame = Math.max(0, player.fame - GameSettings.DEFEAT_FAME_PENALTY);
    if (hadFame) {
      logFn("combat", `${defeatContext}, had no resources to heal so lost ${GameSettings.DEFEAT_FAME_PENALTY} fame`);
    } else {
      logFn("combat", `${defeatContext}, had no resources to heal and no fame to lose`);
    }
    return;
  }

  if (availableResources.length === 1) {
    // Only one resource type available - automatically use it
    const resourceToSpend = availableResources[0];
    player.resources[resourceToSpend.type] -= 1;
    logFn("combat", `${defeatContext}, paid 1 ${resourceToSpend.name.toLowerCase()} to heal`);
    return;
  }

  // Multiple resource types available - ask player to choose
  if (!playerAgent || !gameState || !gameLog) {
    // Fallback: use gold if available, otherwise use the first resource
    const resourceToSpend = availableResources.find(r => r.type === "gold") || availableResources[0];
    player.resources[resourceToSpend.type] -= 1;
    logFn("combat", `${defeatContext}, paid 1 ${resourceToSpend.name.toLowerCase()} to heal (automatic choice)`);
    return;
  }

  // Create decision context for resource choice
  const decisionContext: DecisionContext = {
    description: "Choose which resource to spend for healing:",
    options: availableResources.map(resource => ({
      id: `resource_${resource.type}`,
      description: `1 ${resource.name} (you have ${resource.amount})`
    }))
  };

  try {
    const decision = await playerAgent.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
    const chosenOption = decision.choice;

    if (chosenOption.startsWith("resource_")) {
      const resourceType = chosenOption.split("_")[1] as ResourceType;
      if (player.resources[resourceType] > 0) {
        player.resources[resourceType] -= 1;
        const resourceName = availableResources.find(r => r.type === resourceType)?.name || resourceType;
        logFn("combat", `${defeatContext}, paid 1 ${resourceName.toLowerCase()} to heal`);
      } else {
        // Fallback if somehow the chosen resource is no longer available
        const fallbackResource = availableResources[0];
        player.resources[fallbackResource.type] -= 1;
        logFn("combat", `${defeatContext}, paid 1 ${fallbackResource.name.toLowerCase()} to heal (fallback)`);
      }
    } else {
      // Invalid decision - use fallback
      const fallbackResource = availableResources[0];
      player.resources[fallbackResource.type] -= 1;
      logFn("combat", `${defeatContext}, paid 1 ${fallbackResource.name.toLowerCase()} to heal (fallback)`);
    }
  } catch (error) {
    // Error getting decision - use fallback
    const fallbackResource = availableResources[0];
    player.resources[fallbackResource.type] -= 1;
    logFn("combat", `${defeatContext}, paid 1 ${fallbackResource.name.toLowerCase()} to heal (error fallback)`);
  }
}

/**
 * Handle monster placement and immediate combat (used for adventure cards)
 */
export async function resolveMonsterPlacementAndCombat(
  gameState: GameState,
  monster: Monster,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: GetPlayerAgent
): Promise<CombatResult> {
  // Place monster on tile
  tile.monster = monster;
  logFn("event", `Champion${championId} drew monster card: ${monster.name} (might ${monster.might})!`);

  // Immediately resolve combat using the regular monster combat function
  return await resolveChampionVsMonsterCombat(
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
}
