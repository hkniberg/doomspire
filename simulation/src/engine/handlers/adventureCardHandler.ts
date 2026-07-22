import { getEncounterById } from "@/content/encounterCards";
import { getEventCardById } from "@/content/eventCards";
import { getMonsterCardById } from "@/content/monsterCards";
import { GameState } from "@/game/GameState";
import { Card } from "@/lib/cards";
import { GameSettings } from "@/lib/GameSettings";
import { EventCardResult, GameLogEntry, Monster, Player, Tile } from "@/lib/types";
import { stripCardFormatting } from "@/lib/utils";
import { PlayerAgent } from "@/players/PlayerAgent";
import { resolveMonsterPlacementAndCombat } from "./combatHandler";
import { handleBlessingOfTheLonesome } from "./cardHandlers/blessingOfTheLonesomeHandler";
import { handleCurseOfTheEarth } from "./cardHandlers/curseOfTheEarthHandler";
import { handleDragonHunger } from "./cardHandlers/dragonHungerHandler";
import { handleDragonRaid } from "./cardHandlers/dragonRaidHandler";
import { handleDruidRampage } from "./cardHandlers/druidRampageHandler";
import { handleHungryPests } from "./cardHandlers/hungryPestsHandler";
import { handleLandslide } from "./cardHandlers/landslideHandler";
import { handleMarketDay } from "./cardHandlers/marketDayHandler";
import { handleSeaMonsters } from "./cardHandlers/seaMonstersHandler";
import { handleSuddenStorm } from "./cardHandlers/suddenStormHandler";
import { handleTempleTrial } from "./cardHandlers/templeTrialHandler";
import { handleThievingCrows } from "./cardHandlers/thievingCrowsHandler";
import { handleThugAmbush } from "./cardHandlers/thugAmbushHandler";
import { handleYouGotRiches } from "./cardHandlers/youGotRichesHandler";
import { handleTreasureCard as handleTreasureCardFromHandler } from "./treasureCardHandler";

export interface AdventureCardResult {
  cardProcessed: boolean;
  cardType?: string;
  cardId?: string;
  cardReturnedToDeck?: boolean; // For cards that should be returned to the top of the deck
  monsterPlaced?: {
    monsterName: string;
    combatOccurred: boolean;
    championWon?: boolean;
    championDefeated?: boolean;
    monsterRemains?: boolean;
  };
  eventTriggered?: EventCardResult;
  errorMessage?: string;
}

/**
 * Handle monster cards drawn from adventure decks
 */
export async function handleMonsterCard(
  cardId: string,
  gameState: GameState,
  tile: Tile,
  player: Player,
  championId: number,
  logFn: (type: string, content: string) => void,
  playerAgent?: PlayerAgent,
  gameLog?: readonly GameLogEntry[],
  thinkingLogger?: (content: string) => void
): Promise<AdventureCardResult> {
  // Look up the monster details
  const monsterCard = getMonsterCardById(cardId);
  if (!monsterCard) {
    return {
      cardProcessed: false,
      errorMessage: `Monster card ${cardId} not found`
    };
  }

  // Create the monster object
  const monster: Monster = {
    id: cardId,
    name: monsterCard.name,
    tier: monsterCard.tier,
    icon: monsterCard.icon,
    might: monsterCard.might,
    fame: monsterCard.fame,
    monsterType: monsterCard.monsterType,
    resources: {
      food: monsterCard.resources.food || 0,
      wood: monsterCard.resources.wood || 0,
      ore: monsterCard.resources.ore || 0,
      gold: monsterCard.resources.gold || 0,
    },
  };

  // Use the combat handler for placement and combat
  const combatResult = await resolveMonsterPlacementAndCombat(
    gameState,
    monster,
    tile,
    player,
    championId,
    logFn,
    playerAgent,
    gameLog,
    thinkingLogger
  );

  if (combatResult.victory) {
    return {
      cardProcessed: true,
      cardType: "monster",
      cardId,
      monsterPlaced: {
        monsterName: monster.name,
        combatOccurred: true,
        championWon: true,
        monsterRemains: false,
      },
    };
  } else if (combatResult.defeat) {
    return {
      cardProcessed: true,
      cardType: "monster",
      cardId,
      monsterPlaced: {
        monsterName: monster.name,
        combatOccurred: true,
        championDefeated: true,
        monsterRemains: true,
      },
    };
  } else if (!combatResult.combatOccurred) {
    // This handles the case where the champion fled from the monster
    return {
      cardProcessed: true,
      cardType: "monster",
      cardId,
      monsterPlaced: {
        monsterName: monster.name,
        combatOccurred: false,
        monsterRemains: true,
      },
    };
  } else {
    return {
      cardProcessed: false,
      errorMessage: `Unexpected combat result for monster ${monster.name}`
    };
  }
}

/**
 * Handle event cards drawn from adventure decks
 */
export async function handleEventCardFromAdventure(
  cardId: string,
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: (playerName: string) => PlayerAgent | undefined
): Promise<AdventureCardResult> {
  const eventCard = getEventCardById(cardId);
  if (!eventCard) {
    const errorMessage = `Champion${championId} drew unknown event card ${cardId}`;
    logFn("event", errorMessage);
    return {
      cardProcessed: false,
      errorMessage
    };
  }

  logFn("event", `Champion${championId} drew event card: ${eventCard.name} - ${stripCardFormatting(eventCard.description)}`);

  try {
    let eventResult: EventCardResult;

    // Dispatch to individual event handlers
    if (cardId === "sudden-storm") {
      eventResult = handleSuddenStorm(gameState, logFn);
    } else if (cardId === "hungry-pests") {
      eventResult = await handleHungryPests(gameState, player, playerAgent, logFn, thinkingLogger);
    } else if (cardId === "market-day") {
      eventResult = await handleMarketDay(gameState, player, playerAgent, logFn, thinkingLogger, getPlayerAgent);
    } else if (cardId === "thug-ambush") {
      eventResult = await handleThugAmbush(gameState, player, championId, logFn);
    } else if (cardId === "landslide") {
      eventResult = handleLandslide(gameState, player, championId, logFn);
    } else if (cardId === "riches-for-all") {
      eventResult = handleYouGotRiches(gameState, logFn);
    } else if (cardId === "dragon-hunger") {
      eventResult = handleDragonHunger(gameState, logFn);
    } else if (cardId === "blessing-of-the-lonesome") {
      eventResult = handleBlessingOfTheLonesome(gameState, logFn);
    } else if (cardId === "temple-trial") {
      eventResult = await handleTempleTrial(gameState, player, playerAgent, logFn, thinkingLogger);
    } else if (cardId === "druid-rampage") {
      eventResult = await handleDruidRampage(gameState, tile, player, playerAgent, championId, logFn, thinkingLogger);
    } else if (cardId === "curse-of-the-earth") {
      eventResult = await handleCurseOfTheEarth(gameState, player, playerAgent, logFn, thinkingLogger);
    } else if (cardId === "thieving-crows") {
      eventResult = await handleThievingCrows(gameState, player, playerAgent, logFn, thinkingLogger);
    } else if (cardId === "dragon-raid") {
      eventResult = handleDragonRaid(gameState, logFn);
    } else if (cardId === "sea-monsters") {
      eventResult = await handleSeaMonsters(gameState, player, playerAgent, logFn, thinkingLogger, getPlayerAgent);
    } else {
      // Other event cards not yet implemented
      const message = `Event card ${cardId} drawn, but not yet implemented`;
      logFn("event", message);
      eventResult = {
        eventProcessed: false,
        errorMessage: `Event card ${cardId} not implemented`
      };
    }

    return {
      cardProcessed: true,
      cardType: "event",
      cardId,
      eventTriggered: eventResult
    };
  } catch (error) {
    const errorMessage = `Error handling event card ${cardId}: ${error}`;
    logFn("event", errorMessage);
    return {
      cardProcessed: false,
      errorMessage
    };
  }
}

/**
 * Handle treasure cards drawn from adventure decks
 */
export async function handleTreasureCard(
  cardId: string,
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<AdventureCardResult> {
  const result = await handleTreasureCardFromHandler(
    cardId,
    gameState,
    tile,
    player,
    playerAgent,
    championId,
    gameLog,
    logFn,
    thinkingLogger
  );

  // Convert the result to AdventureCardResult format
  return {
    cardProcessed: result.cardProcessed,
    cardType: "treasure",
    cardId: result.cardId,
    cardReturnedToDeck: result.cardReturnedToDeck,
    errorMessage: result.errorMessage
  };
}

/**
 * Offer a follower to a champion. Followers give combat/utility bonuses.
 * A champion can have at most 2 followers; if full, the player may dismiss one
 * (dismissed followers are removed from the game).
 */
async function offerFollower(
  encounterId: string,
  encounterName: string,
  gameState: GameState,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<boolean> {
  const champion = gameState.getChampion(player.name, championId);
  if (!champion) {
    return false;
  }

  if (champion.followers.length < GameSettings.MAX_FOLLOWERS_PER_CHAMPION) {
    champion.followers.push({ id: encounterId, name: encounterName });
    logFn("event", `${encounterName} joins Champion${championId} as a follower!`);
    return true;
  }

  // Champion is at follower capacity - offer to dismiss one
  try {
    const decision = await playerAgent.makeDecision(gameState, gameLog, {
      description: `Champion${championId} already has ${GameSettings.MAX_FOLLOWERS_PER_CHAMPION} followers. Dismiss one to take on ${encounterName}? (Dismissed followers are removed from the game.)`,
      options: [
        ...champion.followers.map((follower, index) => ({
          id: `dismiss_${index}`,
          description: `Dismiss ${follower.name} and take ${encounterName}`
        })),
        { id: "decline", description: `Decline ${encounterName}` }
      ]
    }, thinkingLogger);

    if (decision.choice.startsWith("dismiss_")) {
      const index = parseInt(decision.choice.split("_")[1]);
      if (index >= 0 && index < champion.followers.length) {
        const dismissed = champion.followers.splice(index, 1)[0];
        champion.followers.push({ id: encounterId, name: encounterName });
        logFn("event", `Champion${championId} dismisses ${dismissed.name} and takes on ${encounterName} as a follower.`);
        return true;
      }
    }
  } catch (error) {
    // Decline on error
  }

  logFn("event", `Champion${championId} declines ${encounterName}.`);
  return false;
}

/**
 * Handle encounter cards drawn from adventure decks (most encounters offer followers)
 */
export async function handleEncounterCard(
  cardId: string,
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<AdventureCardResult> {
  const encounter = getEncounterById(cardId);
  if (!encounter) {
    logFn("event", `Champion${championId} drew unknown encounter card ${cardId}`);
    return {
      cardProcessed: false,
      cardType: "encounter",
      cardId,
      errorMessage: `Unknown encounter card: ${cardId}`
    };
  }

  logFn("event", `Champion${championId} encountered: ${encounter.name} - ${stripCardFormatting(encounter.description)}`);

  switch (cardId) {
    case "angry-dog": {
      // Give it 2 food to gain it as a follower (+1 might in battle), or be chased home
      if (player.resources.food >= 2) {
        let feed = true;
        try {
          const decision = await playerAgent.makeDecision(gameState, gameLog, {
            description: `An angry dog blocks the path! Give it 2 food (it joins as a follower granting +1 might in battle), or refuse and be chased home.`,
            options: [
              { id: "feed", description: "Give it 2 food (gain the dog as a follower)" },
              { id: "refuse", description: "Refuse (champion is chased home)" }
            ]
          }, thinkingLogger);
          feed = decision.choice === "feed";
        } catch (error) {
          feed = true;
        }

        if (feed) {
          player.resources.food -= 2;
          logFn("event", `Champion${championId} feeds the angry dog 2 food.`);
          await offerFollower(cardId, encounter.name, gameState, player, playerAgent, championId, gameLog, logFn, thinkingLogger);
          return { cardProcessed: true, cardType: "encounter", cardId };
        }
      } else {
        logFn("event", `Champion${championId} cannot afford to feed the angry dog (2 food needed).`);
      }

      // Chased home
      gameState.moveChampionToHome(player.name, championId);
      logFn("event", `Champion${championId} is chased home by the angry dog!`);
      return { cardProcessed: true, cardType: "encounter", cardId };
    }

    case "priestess":
    case "proud-mercenary":
    case "brawler":
    case "witch":
    case "fairy-godmother": {
      // Simple follower offers
      await offerFollower(cardId, encounter.name, gameState, player, playerAgent, championId, gameLog, logFn, thinkingLogger);
      return { cardProcessed: true, cardType: "encounter", cardId };
    }

    default: {
      logFn("event", `Encounter card ${encounter.name} (${cardId}) is not implemented - nothing happens.`);
      return {
        cardProcessed: false,
        cardType: "encounter",
        cardId,
        errorMessage: `Encounter card ${cardId} not implemented`
      };
    }
  }
}

/**
 * Handle follower cards drawn from adventure decks (same handling as encounters)
 */
export async function handleFollowerCard(
  cardId: string,
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<AdventureCardResult> {
  return handleEncounterCard(cardId, gameState, tile, player, playerAgent, championId, gameLog, logFn, thinkingLogger);
}

/**
 * Main adventure card handler dispatcher
 */
export async function handleAdventureCard(
  adventureCard: Card,
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  gameLog: readonly GameLogEntry[],
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void,
  getPlayerAgent?: (playerName: string) => PlayerAgent | undefined
): Promise<AdventureCardResult> {
  const cardType = adventureCard.type;
  const cardId = adventureCard.id;

  switch (cardType) {
    case "monster":
      return await handleMonsterCard(cardId, gameState, tile, player, championId, logFn, playerAgent, gameLog, thinkingLogger);

    case "event":
      return await handleEventCardFromAdventure(cardId, gameState, tile, player, playerAgent, championId, gameLog, logFn, thinkingLogger, getPlayerAgent);

    case "treasure":
      return await handleTreasureCard(cardId, gameState, tile, player, playerAgent, championId, gameLog, logFn, thinkingLogger);

    case "encounter":
      return await handleEncounterCard(cardId, gameState, tile, player, playerAgent, championId, gameLog, logFn, thinkingLogger);

    case "follower":
      return await handleFollowerCard(cardId, gameState, tile, player, playerAgent, championId, gameLog, logFn, thinkingLogger);

    default:
      const errorMessage = `Champion${championId} drew unknown card type ${cardType} with id ${cardId}`;
      logFn("event", errorMessage);
      return {
        cardProcessed: false,
        errorMessage
      };
  }
}

