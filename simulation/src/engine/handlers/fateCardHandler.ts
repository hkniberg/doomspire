import { FateCard } from "@/content/fateCards";
import { getMonsterCardById } from "@/content/monsterCards";
import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { DecisionContext, DecisionOption, GameLogEntry, Player, Position, ResourceType, TileType } from "@/lib/types";
import { PlayerAgent } from "@/players/PlayerAgent";

/**
 * Resolves the fate card drawn during the fate phase.
 *
 * Council votes are polled from each player agent, weighted by the voter's fame. A tie means no effect.
 * Votes are secret and simultaneous: all votes are collected before any of them are revealed (logged),
 * so no voter can see how the others voted. Players with 0 fame are skipped, since their vote weight
 * is 0 and cannot affect the outcome. (Simulator deviation: votes are one-shot decisions with no table
 * talk. If all players have 0 fame, the result is always a tie / no effect.)
 *
 * Round-scoped effects are stored in gameState.fateEffects and read by the relevant handlers.
 */

type LogFn = (type: string, content: string) => void;

function rollD3(): number {
  const outcomes = [1, 1, 2, 2, 3, 3];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

interface FateContext {
  card: FateCard;
  gameState: GameState;
  playerAgents: PlayerAgent[];
  gameLog: readonly GameLogEntry[];
  logFn: LogFn;
  // Receives the deciding player's name, so parallel fate-phase thinking can be attributed in the log
  thinkingLogger?: (playerName: string, content: string) => void;
}

function getAgent(ctx: FateContext, playerName: string): PlayerAgent | undefined {
  const index = ctx.gameState.players.findIndex((p) => p.name === playerName);
  return index >= 0 ? ctx.playerAgents[index] : undefined;
}

async function askDecision(
  ctx: FateContext,
  playerName: string,
  description: string,
  options: DecisionOption[]
): Promise<string> {
  const agent = getAgent(ctx, playerName);
  if (!agent || options.length === 0) {
    return options[0]?.id ?? "";
  }
  if (options.length === 1) {
    return options[0].id;
  }
  try {
    const playerThinkingLogger = ctx.thinkingLogger
      ? (content: string) => ctx.thinkingLogger!(playerName, content)
      : undefined;
    const decision = await agent.makeDecision(ctx.gameState, ctx.gameLog, { description, options }, playerThinkingLogger);
    if (options.some((o) => o.id === decision.choice)) {
      return decision.choice;
    }
    ctx.logFn("error", `${playerName} answered "${decision.choice}" which is not a valid option - defaulting to "${options[0].id}"`);
    return options[0].id;
  } catch (error) {
    ctx.logFn("error", `${playerName}'s decision failed (${error instanceof Error ? error.message : String(error)}) - defaulting to "${options[0].id}"`);
    return options[0].id;
  }
}

/**
 * Build the description for a council vote prompt: full fate card text plus the question.
 * Votes are secret and simultaneous, so the voter is told not to expect other players' votes.
 */
function buildVoteDescription(ctx: FateContext, question: string, voterFame: number): string {
  const cardEffect = ctx.card.effect.replace(/\*/g, "");
  return `Council vote on the fate card "${ctx.card.name}" (card effect: ${cardEffect}) ` +
    `Question: ${question} Your vote is weighted by your fame (${voterFame}). ` +
    `Votes are secret and cast simultaneously - you will not see how others voted until all votes are in.`;
}

/**
 * Council vote YES/NO, weighted by fame. Returns true if YES wins (tie = no).
 *
 * Votes are secret and simultaneous: all votes are collected before any are revealed (logged).
 * Players with 0 fame are skipped since their vote weight cannot affect the outcome.
 */
async function councilVoteYesNo(ctx: FateContext, question: string): Promise<boolean> {
  const votes: Array<{ player: Player; choice: string }> = [];

  for (const player of ctx.gameState.players) {
    if (player.fame === 0) {
      continue; // Vote weight 0 - can't affect the outcome, so don't prompt
    }
    const choice = await askDecision(ctx, player.name, buildVoteDescription(ctx, question, player.fame), [
      { id: "yes", description: "Vote YES" },
      { id: "no", description: "Vote NO" }
    ]);
    votes.push({ player, choice });
  }

  // All votes collected - now reveal them
  let yesWeight = 0;
  let noWeight = 0;
  for (const player of ctx.gameState.players) {
    const vote = votes.find((v) => v.player === player);
    if (!vote) {
      ctx.logFn("fate", `${player.name} abstains (0 fame, vote weight 0)`);
      continue;
    }
    if (vote.choice === "yes") {
      yesWeight += player.fame;
    } else {
      noWeight += player.fame;
    }
    ctx.logFn("fate", `${player.name} votes ${vote.choice.toUpperCase()} (weight ${player.fame})`);
  }

  const yesWins = yesWeight > noWeight;
  ctx.logFn("fate", `Vote result: YES ${yesWeight} vs NO ${noWeight} - ${yesWins ? "YES wins" : yesWeight === noWeight ? "tie, no effect" : "NO wins, no effect"}`);
  return yesWins;
}

/**
 * Council vote for a target player, weighted by fame. Returns the target, or null on a tie.
 *
 * Votes are secret and simultaneous: all votes are collected before any are revealed (logged).
 * Players with 0 fame are skipped since their vote weight cannot affect the outcome.
 */
async function councilVoteTarget(ctx: FateContext, question: string): Promise<Player | null> {
  const weights: Record<string, number> = {};
  for (const player of ctx.gameState.players) {
    weights[player.name] = 0;
  }

  const votes: Array<{ player: Player; choice: string }> = [];
  for (const player of ctx.gameState.players) {
    if (player.fame === 0) {
      continue; // Vote weight 0 - can't affect the outcome, so don't prompt
    }
    const options: DecisionOption[] = ctx.gameState.players.map((p) => ({
      id: p.name,
      description: `Vote for ${p.name}`
    }));
    const choice = await askDecision(ctx, player.name, buildVoteDescription(ctx, question, player.fame), options);
    votes.push({ player, choice });
  }

  // All votes collected - now reveal them
  for (const player of ctx.gameState.players) {
    const vote = votes.find((v) => v.player === player);
    if (!vote) {
      ctx.logFn("fate", `${player.name} abstains (0 fame, vote weight 0)`);
      continue;
    }
    weights[vote.choice] += player.fame;
    ctx.logFn("fate", `${player.name} votes for ${vote.choice} (weight ${player.fame})`);
  }

  const maxWeight = Math.max(...Object.values(weights));
  const leaders = Object.entries(weights).filter(([, w]) => w === maxWeight).map(([name]) => name);

  if (leaders.length !== 1 || maxWeight === 0) {
    ctx.logFn("fate", `Vote result: tied - no one is affected`);
    return null;
  }

  ctx.logFn("fate", `Vote result: ${leaders[0]} is targeted (weight ${maxWeight})`);
  return ctx.gameState.getPlayer(leaders[0]) || null;
}

function totalResources(player: Player): number {
  return player.resources.food + player.resources.wood + player.resources.ore + player.resources.gold;
}

function availableResourceTypes(player: Player): ResourceType[] {
  return (["food", "wood", "ore", "gold"] as ResourceType[]).filter((type) => player.resources[type] > 0);
}

/**
 * Ask a player which resource to give away (from their available resources). Returns null if they have none.
 */
async function chooseResourceToGive(ctx: FateContext, player: Player, prompt: string): Promise<ResourceType | null> {
  const types = availableResourceTypes(player);
  if (types.length === 0) return null;
  const choice = await askDecision(ctx, player.name, prompt, types.map((type) => ({
    id: type,
    description: `Give 1 ${type} (you have ${player.resources[type]})`
  })));
  return choice as ResourceType;
}

/**
 * Ask a player which resource to gain.
 */
async function chooseResourceToGain(ctx: FateContext, player: Player, prompt: string): Promise<ResourceType> {
  const types: ResourceType[] = ["food", "wood", "ore", "gold"];
  const choice = await askDecision(ctx, player.name, prompt, types.map((type) => ({
    id: type,
    description: `Gain 1 ${type}`
  })));
  return choice as ResourceType;
}

function transferResource(from: Player, to: Player, type: ResourceType, ctx: FateContext): void {
  if (from.resources[type] > 0) {
    from.resources[type] -= 1;
    to.resources[type] += 1;
    ctx.logFn("fate", `${from.name} gives 1 ${type} to ${to.name}`);
  }
}

function findTileOfType(ctx: FateContext, tileType: TileType): Position | null {
  const tiles = ctx.gameState.board.findTiles((tile) => tile.tileType === tileType);
  return tiles.length > 0 ? tiles[0].position : null;
}

/**
 * Move all knights of all players to a given tile (used by gathering cards).
 * Special tiles are non-combat zones, so any number of knights can be there.
 */
function moveAllKnightsTo(ctx: FateContext, position: Position, tileLabel: string): void {
  for (const player of ctx.gameState.players) {
    for (const champion of player.champions) {
      champion.position = { ...position };
    }
  }
  ctx.logFn("fate", `All knights move to the ${tileLabel}`);
}

function playersWithMost(players: Player[], value: (p: Player) => number): Player[] {
  const max = Math.max(...players.map(value));
  return players.filter((p) => value(p) === max);
}

function playersWithFewest(players: Player[], value: (p: Player) => number): Player[] {
  const min = Math.min(...players.map(value));
  return players.filter((p) => value(p) === min);
}

function countResourceTiles(gameState: GameState, playerName: string): number {
  return gameState.board.findTiles((tile) => tile.tileType === "resource" && tile.claimedBy === playerName).length;
}

/**
 * Resolve a fate card. Immediate effects are applied directly; round-scoped effects are
 * written to gameState.fateEffects.
 */
export async function resolveFateCard(
  card: FateCard,
  gameState: GameState,
  playerAgents: PlayerAgent[],
  gameLog: readonly GameLogEntry[],
  logFn: LogFn,
  thinkingLogger?: (playerName: string, content: string) => void
): Promise<void> {
  const ctx: FateContext = { card, gameState, playerAgents, gameLog, logFn, thinkingLogger };
  const players = gameState.players;

  gameState.fateEffects.fateCardId = card.id;
  gameState.fateEffects.fateCardName = card.name;
  gameState.fateEffects.fateCardEffect = card.effect.replace(/\*/g, "");

  switch (card.id) {
    // ============ Event cards ============

    case "settling": {
      gameState.fateEffects.settling = true;
      logFn("fate", `Settling: no deliberate combat this round. Knights cannot move into a tile with another knight or a creature.`);
      break;
    }

    case "bountiful-harvest": {
      gameState.fateEffects.doubleHarvest = true;
      logFn("fate", `Bountiful Harvest: all harvests produce double resources this round.`);
      break;
    }

    case "ceasefire": {
      gameState.fateEffects.noPvpCombat = true;
      logFn("fate", `Ceasefire: no PVP combat this round. Knights may pass through each other freely.`);
      break;
    }

    case "fog-of-war": {
      gameState.fateEffects.noBoatMovement = true;
      gameState.fateEffects.noBoatTransport = true;
      logFn("fate", `Fog of War: no boat movement or transport this round.`);
      break;
    }

    case "dragons-shadow": {
      for (const player of players) {
        for (const champion of player.champions) {
          const tile = gameState.board.getTileAt(champion.position);
          // Hills (tier 2) and mountains (tier 3). Knights already at Doomspire are unaffected.
          if (tile && (tile.tier ?? 1) >= 2 && tile.tileType !== "doomspire") {
            champion.position = { ...player.homePosition };
            logFn("fate", `${player.name}'s champion${champion.id} flees home from the dragon's shadow`);
          }
        }
      }
      break;
    }

    case "oasis-bloom": {
      let tilesRefreshed = 0;
      gameState.board.forEachTile((tile) => {
        if ((tile.tileType === "oasis" || tile.tileType === "adventure") && tile.adventureTokens === 0) {
          tile.adventureTokens = 1;
          tilesRefreshed++;
        }
      });
      logFn("fate", `Oasis Bloom: ${tilesRefreshed} depleted adventure/oasis tile(s) gain +1 adventure token.`);
      break;
    }

    case "storm-season": {
      const clockwise: Record<string, "nw" | "ne" | "se" | "sw"> = { nw: "ne", ne: "se", se: "sw", sw: "nw" };
      for (const player of players) {
        for (const boat of player.boats) {
          const from = boat.position;
          boat.position = clockwise[boat.position];
          logFn("fate", `${player.name}'s boat${boat.id} is pushed from ${from} to ${boat.position}`);
        }
      }
      gameState.fateEffects.noBoatTransport = true;
      logFn("fate", `Storm Season: boats cannot transport knights this round.`);
      break;
    }

    case "merchant-fair": {
      gameState.fateEffects.traderRate1to1 = true;
      gameState.fateEffects.buildCostReduction = true;
      logFn("fate", `Merchant Fair: trader exchanges are 1:1 this round, and building costs are reduced by 1 of each resource type (minimum 1).`);
      break;
    }

    case "dragon-sleeping": {
      gameState.fateEffects.dragonCombatImpressionOnly = true;
      gameState.fateEffects.dragonMightModifier = -2;
      logFn("fate", `Dragon Sleeping: the dragon can only be impressed by combat this round, but its might is reduced by 2.`);
      break;
    }

    case "dragon-off-hunting": {
      gameState.fateEffects.dragonAbsent = true;
      logFn("fate", `Dragon Off Hunting: the dragon is absent. Knights at Doomspire may take a treasure stack, but cannot impress the dragon.`);
      break;
    }

    case "prosperous-crops": {
      gameState.fateEffects.noDiceTax = true;
      logFn("fate", `Prosperous Crops: no dice tax this round - all dice beyond the first ${GameSettings.FREE_DICE_COUNT} are free.`);
      break;
    }

    case "lean-times": {
      gameState.fateEffects.diceTaxPerDie = 3;
      logFn("fate", `Lean Times: the dice tax is 3 food per extra die this round (instead of ${GameSettings.DICE_TAX_FOOD_PER_DIE}).`);
      break;
    }

    case "trade-boom": {
      gameState.fateEffects.marketRate1to1 = true;
      logFn("fate", `Trade Boom: all Markets sell resources at 1:1 instead of 2:1 this round.`);
      break;
    }

    case "dragon-gifts": {
      // Ranked payout by fame: most fame = 3 resources, second most = 2, everyone else = 1.
      // Tied players share the higher reward, so ranks are based on distinct fame levels.
      const fameLevels = [...new Set(players.map((p) => p.fame))].sort((a, b) => b - a);
      for (const player of players) {
        const rank = fameLevels.indexOf(player.fame);
        const amount = rank === 0 ? 3 : rank === 1 ? 2 : 1;
        logFn("fate", `Dragon Gifts: ${player.name} (fame ${player.fame}) receives ${amount} resource(s)`);
        for (let i = 0; i < amount; i++) {
          const type = await chooseResourceToGain(ctx, player, `Dragon Gifts: choose resource ${i + 1} of ${amount} to gain.`);
          player.resources[type] += 1;
          logFn("fate", `${player.name} gains 1 ${type}`);
        }
      }
      break;
    }

    case "beasts-are-stirring": {
      // In turn order, each player may place a beast on an empty den:
      // a wolf on a wolf den, a bear on a bear cave. Dens occupied by a knight are skipped,
      // since placing a monster under a knight would bypass normal arrival combat.
      const isDenOccupiedByKnight = (position: Position): boolean =>
        players.some((p) => p.champions.some((c) => c.position.row === position.row && c.position.col === position.col));

      for (const player of players) {
        const emptyDens = gameState.board.findTiles(
          (tile) =>
            (tile.tileType === "wolfDen" || tile.tileType === "bearCave") &&
            !tile.monster &&
            !isDenOccupiedByKnight(tile.position)
        );
        if (emptyDens.length === 0) {
          logFn("fate", `Beasts Are Stirring: no empty dens remain - nothing happens for ${player.name}`);
          continue;
        }
        const options: DecisionOption[] = [
          { id: "decline", description: "Do not place a beast" },
          ...emptyDens.map((tile) => ({
            id: `${tile.position.row},${tile.position.col}`,
            description: `Place a ${tile.tileType === "wolfDen" ? "wolf on the wolf den" : "bear on the bear cave"} at (${tile.position.row}, ${tile.position.col})`
          }))
        ];
        const choice = await askDecision(
          ctx,
          player.name,
          `Beasts Are Stirring: you may place a beast on an empty den (a wolf in the flatlands, a bear in the hills), or decline.`,
          options
        );
        if (choice === "decline") {
          logFn("fate", `Beasts Are Stirring: ${player.name} declines to place a beast`);
          continue;
        }
        const [row, col] = choice.split(",").map(Number);
        const denTile = gameState.getTile({ row, col });
        if (denTile && !denTile.monster) {
          const monsterCard = getMonsterCardById(denTile.tileType === "wolfDen" ? "wolf" : "bear");
          if (monsterCard) {
            denTile.monster = monsterCard;
            logFn("fate", `Beasts Are Stirring: ${player.name} places a ${monsterCard.name} on the den at (${row}, ${col})`);
          }
        }
      }
      break;
    }

    // ============ Minor cards ============

    case "favorable-winds": {
      gameState.fateEffects.boatMovementBonus = 1;
      logFn("fate", `Favorable Winds: all boat movements get +1 step this round.`);
      break;
    }

    case "the-gift": {
      // Starting from the player with the most fame, each player passes 1 resource to the player on their left
      const order = [...players].sort((a, b) => b.fame - a.fame);
      for (const giver of order) {
        const giverIndex = players.findIndex((p) => p.name === giver.name);
        const receiver = players[(giverIndex + 1) % players.length];
        const type = await chooseResourceToGive(ctx, giver, `The Gift: choose 1 resource to pass to ${receiver.name} (the player on your left).`);
        if (type) {
          transferResource(giver, receiver, type, ctx);
        } else {
          logFn("fate", `${giver.name} has no resources to give`);
        }
      }
      break;
    }

    case "fortune-smiles": {
      const poorest = playersWithFewest(players, totalResources);
      const lucky = poorest[Math.floor(Math.random() * poorest.length)];
      for (let i = 0; i < 3; i++) {
        const type = await chooseResourceToGain(ctx, lucky, `Fortune Smiles: choose resource ${i + 1} of 3 to gain.`);
        lucky.resources[type] += 1;
      }
      logFn("fate", `Fortune Smiles: ${lucky.name} (fewest total resources) gains 3 resources of their choice.`);
      break;
    }

    case "tailwind": {
      gameState.fateEffects.knightMovementBonus = 1;
      logFn("fate", `Tailwind: each knight movement gets +1 step this round (once per movement, even when sprinting).`);
      break;
    }

    case "bounty": {
      gameState.fateEffects.monsterFameBonus = 1;
      logFn("fate", `Bounty: defeating a monster grants +1 fame this round.`);
      break;
    }

    case "homesteading": {
      gameState.fateEffects.claimFameBonus = 1;
      logFn("fate", `Homesteading: claiming a resource tile grants +1 fame this round.`);
      break;
    }

    case "cartographers-prize": {
      gameState.fateEffects.explorationFameBonus = 1;
      logFn("fate", `Cartographer's Prize: exploring a tile grants +1 extra fame this round.`);
      break;
    }

    // ============ Council vote cards (YES/NO) ============

    case "tax-the-crown": {
      const yesWins = await councilVoteYesNo(ctx, "Should the richest player pay 4 gold, distributed among the other players?");
      if (yesWins) {
        const richest = playersWithMost(players, (p) => p.resources.gold);
        const paymentPerPayer = richest.length > 1 ? 2 : 4;
        for (const payer of richest) {
          // Simulator deviation: the payment is distributed round-robin among the other players
          // in seat order (the rules let the payer choose the distribution).
          const others = players.filter((p) => p.name !== payer.name);
          let paid = 0;
          let receiverIndex = 0;
          while (paid < paymentPerPayer && payer.resources.gold > 0) {
            const receiver = others[receiverIndex % others.length];
            transferResource(payer, receiver, "gold", ctx);
            paid++;
            receiverIndex++;
          }
          logFn("fate", `Tax the Crown: ${payer.name} paid ${paid} gold`);
        }
      }
      break;
    }

    case "land-reform": {
      const yesWins = await councilVoteYesNo(ctx, "Should the player with the most resource tiles give 1 tile away?");
      if (yesWins) {
        const most = playersWithMost(players, (p) => countResourceTiles(gameState, p.name));
        for (const giver of most) {
          const ownedTiles = gameState.board.findTiles((tile) => tile.tileType === "resource" && tile.claimedBy === giver.name);
          if (ownedTiles.length === 0) {
            logFn("fate", `Land Reform: ${giver.name} has no resource tiles to give`);
            continue;
          }
          // Recipient: the player with the fewest resource tiles (simulator deviation - the rules let the giver choose)
          const others = players.filter((p) => p.name !== giver.name);
          const fewest = playersWithFewest(others, (p) => countResourceTiles(gameState, p.name));
          const receiver = fewest[Math.floor(Math.random() * fewest.length)];

          const tileChoice = await askDecision(ctx, giver.name,
            `Land Reform: you must give 1 resource tile to ${receiver.name}. Choose which tile:`,
            ownedTiles.map((tile) => ({
              id: `${tile.position.row},${tile.position.col}`,
              description: `Tile (${tile.position.row}, ${tile.position.col})${tile.isStarred ? " (starred)" : ""}`
            }))
          );
          const [row, col] = tileChoice.split(",").map(Number);
          const tile = gameState.getTile({ row, col });
          if (tile) {
            tile.claimedBy = receiver.name;
            logFn("fate", `Land Reform: ${giver.name} gives tile (${row}, ${col}) to ${receiver.name}`);
          }
        }
      }
      break;
    }

    case "charity-decree": {
      const yesWins = await councilVoteYesNo(ctx, "Should everyone give 1 resource to the poorest player(s)?");
      if (yesWins) {
        const poorest = playersWithFewest(players, totalResources);
        const poorestNames = poorest.map((p) => p.name);
        for (const giver of players) {
          if (poorestNames.includes(giver.name)) continue;
          const receiver = poorest[Math.floor(Math.random() * poorest.length)];
          const type = await chooseResourceToGive(ctx, giver, `Charity Decree: choose 1 resource to give to ${receiver.name}.`);
          if (type) {
            transferResource(giver, receiver, type, ctx);
          }
        }
      }
      break;
    }

    case "famine": {
      const yesWins = await councilVoteYesNo(ctx, "Should harvesting be banned this round?");
      if (yesWins) {
        gameState.fateEffects.harvestBlockedForAll = true;
        logFn("fate", `Famine: no player may harvest this round.`);
      }
      break;
    }

    case "war-tax": {
      const yesWins = await councilVoteYesNo(ctx, "Should players with 3+ might pay 2 gold or lose 1 might?");
      if (yesWins) {
        for (const player of players) {
          if (player.might < 3) continue;
          let payGold = false;
          if (player.resources.gold >= 2) {
            const choice = await askDecision(ctx, player.name, `War Tax: you have ${player.might} might. Pay 2 gold or lose 1 might?`, [
              { id: "pay", description: "Pay 2 gold" },
              { id: "might", description: "Lose 1 might" }
            ]);
            payGold = choice === "pay";
          }
          if (payGold) {
            player.resources.gold -= 2;
            logFn("fate", `War Tax: ${player.name} pays 2 gold`);
          } else {
            player.might = Math.max(0, player.might - 1);
            logFn("fate", `War Tax: ${player.name} loses 1 might`);
          }
        }
      }
      break;
    }

    case "fame-reversal": {
      const yesWins = await councilVoteYesNo(ctx, "Should the most famous lose 2 fame and the least famous gain 2 fame?");
      if (yesWins) {
        const most = playersWithMost(players, (p) => p.fame);
        const least = playersWithFewest(players, (p) => p.fame);
        for (const player of most) {
          player.fame = Math.max(0, player.fame - 2);
          logFn("fate", `Fame Reversal: ${player.name} loses 2 fame`);
        }
        for (const player of least) {
          player.fame += 2;
          logFn("fate", `Fame Reversal: ${player.name} gains 2 fame`);
        }
      }
      break;
    }

    // ============ Council vote cards (TARGET) ============

    case "disarmament": {
      const target = await councilVoteTarget(ctx, "Who should lose 2 might?");
      if (target) {
        target.might = Math.max(0, target.might - 2);
        logFn("fate", `Disarmament: ${target.name} loses 2 might (now ${target.might})`);
      }
      break;
    }

    case "banishment": {
      const target = await councilVoteTarget(ctx, "Whose knights should all be sent home?");
      if (target) {
        for (const champion of target.champions) {
          champion.position = { ...target.homePosition };
        }
        logFn("fate", `Banishment: all of ${target.name}'s knights are sent home`);
      }
      break;
    }

    case "harvest-ban": {
      const target = await councilVoteTarget(ctx, "Who should be banned from harvesting this round?");
      if (target) {
        gameState.fateEffects.harvestBlockedForPlayer = target.name;
        logFn("fate", `Harvest Ban: ${target.name} cannot harvest this round`);
      }
      break;
    }

    case "lockdown": {
      const target = await councilVoteTarget(ctx, "Whose knights should be locked down this round (no knight movement)?");
      if (target) {
        gameState.fateEffects.lockdownPlayer = target.name;
        logFn("fate", `Lockdown: ${target.name} cannot move any knights this round (boats and harvesting still allowed)`);
      }
      break;
    }

    case "penalty": {
      const target = await councilVoteTarget(ctx, "Who should roll one fewer die this round?");
      if (target) {
        gameState.fateEffects.dicePenaltyPlayer = target.name;
        logFn("fate", `Penalty: ${target.name} rolls one fewer die this round (minimum 1)`);
      }
      break;
    }

    case "royal-honor": {
      const target = await councilVoteTarget(ctx, "Who should be honored with 2 fame?");
      if (target) {
        target.fame += 2;
        logFn("fate", `Royal Honor: ${target.name} gains 2 fame (now ${target.fame})`);
      }
      break;
    }

    // ============ Gathering cards ============

    case "festival": {
      const yesWins = await councilVoteYesNo(ctx, "Should a grand festival be held at the trader's bazaar?");
      if (yesWins) {
        const traderPos = findTileOfType(ctx, "trader");
        if (traderPos) {
          moveAllKnightsTo(ctx, traderPos, "Trader");
          // Each player may make one free 1:1 trade (simulator interpretation: exchange 1 resource for 1 other resource)
          for (const player of players) {
            const giveTypes = availableResourceTypes(player);
            if (giveTypes.length === 0) continue;
            const options: DecisionOption[] = [{ id: "none", description: "No trade" }];
            for (const give of giveTypes) {
              for (const get of ["food", "wood", "ore", "gold"] as ResourceType[]) {
                if (give === get) continue;
                options.push({ id: `${give}_${get}`, description: `Trade 1 ${give} for 1 ${get}` });
              }
            }
            const choice = await askDecision(ctx, player.name, `Festival: you may make one free 1:1 trade.`, options);
            if (choice !== "none") {
              const [give, get] = choice.split("_") as ResourceType[];
              if (player.resources[give] > 0) {
                player.resources[give] -= 1;
                player.resources[get] += 1;
                logFn("fate", `Festival: ${player.name} trades 1 ${give} for 1 ${get}`);
              }
            }
          }
        }
      }
      break;
    }

    case "grand-tourney": {
      const yesWins = await councilVoteYesNo(ctx, "Should a grand tourney be held at the mercenary camp?");
      if (yesWins) {
        const mercenaryPos = findTileOfType(ctx, "mercenary");
        if (mercenaryPos) {
          moveAllKnightsTo(ctx, mercenaryPos, "Mercenary Camp");
          // All players roll 1D3 - highest roller gains 1 might (ties reroll)
          let contenders = [...players];
          while (contenders.length > 1) {
            const rolls = contenders.map((p) => ({ player: p, roll: rollD3() }));
            logFn("fate", `Tourney rolls: ${rolls.map((r) => `${r.player.name} [${r.roll}]`).join(", ")}`);
            const maxRoll = Math.max(...rolls.map((r) => r.roll));
            contenders = rolls.filter((r) => r.roll === maxRoll).map((r) => r.player);
            if (contenders.length > 1) {
              logFn("fate", `Tied - rerolling between ${contenders.map((p) => p.name).join(", ")}`);
            }
          }
          contenders[0].might += 1;
          logFn("fate", `Grand Tourney: ${contenders[0].name} wins the tourney and gains 1 might!`);
        }
      }
      break;
    }

    case "prayer-day": {
      const yesWins = await councilVoteYesNo(ctx, "Should a day of prayer be held at the temple?");
      if (yesWins) {
        const templePos = findTileOfType(ctx, "temple");
        if (templePos) {
          moveAllKnightsTo(ctx, templePos, "Temple");
          for (const player of players) {
            player.fame += 1;
          }
          logFn("fate", `Prayer Day: all players gain 1 fame`);
        }
      }
      break;
    }

    default: {
      logFn("fate", `Fate card ${card.name} (${card.id}) has no implemented effect - skipping.`);
      break;
    }
  }
}
