import { getEventCardById } from "@/content/eventCards";
import { getMonsterCardById } from "@/content/monsterCards";
import { GameState } from "@/game/GameState";
import { Card } from "@/lib/cards";
import { EventCardResult, GameLogEntry, Monster, Player, Tile } from "@/lib/types";
import { PlayerAgent } from "@/players/PlayerAgent";
import { resolveMonsterPlacementAndCombat } from "./combatHandler";
import { handleCurseOfTheEarth } from "./cardHandlers/curseOfTheEarthHandler";
import { handleDragonRaid } from "./cardHandlers/dragonRaidHandler";
import { handleDruidRampage } from "./cardHandlers/druidRampageHandler";
import { handleHungryPests } from "./cardHandlers/hungryPestsHandler";
import { handleLandslide } from "./cardHandlers/landslideHandler";
import { handleMarketDay } from "./cardHandlers/marketDayHandler";
import { handleSeaMonsters } from "./cardHandlers/seaMonstersHandler";
import { handleSuddenStorm } from "./cardHandlers/suddenStormHandler";
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

  logFn("event", `Champion${championId} drew event card: ${eventCard.name}!`);

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
    } else if (cardId === "you-got-riches") {
      eventResult = handleYouGotRiches(gameState, logFn);
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
 * Handle encounter cards drawn from adventure decks
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
  // Encounter cards not yet implemented
  logFn("event", `Champion${championId} drew encounter card ${cardId}, but encounter cards aren't implemented yet.`);

  return {
    cardProcessed: false,
    cardType: "encounter",
    cardId,
    errorMessage: "Encounter cards not implemented"
  };
}

/**
 * Handle follower cards drawn from adventure decks
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
  // Follower cards not yet implemented
  logFn("event", `Champion${championId} drew follower card ${cardId}, but follower cards aren't implemented yet.`);

  return {
    cardProcessed: false,
    cardType: "follower",
    cardId,
    errorMessage: "Follower cards not implemented"
  };
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

