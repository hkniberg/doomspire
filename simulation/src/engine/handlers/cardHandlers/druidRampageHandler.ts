import { getMonsterCardById } from "@/content/monsterCards";
import { GameState } from "@/game/GameState";
import { CarriableItem, Decision, EventCardResult, Monster, Player, Tile, TileTier } from "@/lib/types";
import { PlayerAgent } from "@/players/PlayerAgent";
import { canChampionCarryMoreItems, createDropItemDecision, handleDropItemDecision } from "@/players/PlayerUtils";

/**
 * Create a runed dagger item (+1 might)
 */
function createRunedDagger(): CarriableItem {
  return {
    treasureCard: {
      id: "runed-dagger",
      name: "Runed Dagger",
      tier: 2 as TileTier,
      description: "A mystical blade from the wild druid. Gain +1 might.",
      count: 1,
      carriable: true
    },
    combatBonus: 1
  };
}



/**
 * Handle the druid-rampage event card
 */
export async function handleDruidRampage(
  gameState: GameState,
  tile: Tile,
  player: Player,
  playerAgent: PlayerAgent,
  championId: number,
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<EventCardResult> {
  const champion = player.champions.find(c => c.id === championId);
  if (!champion) {
    const errorMessage = `Champion${championId} not found for player ${player.name}`;
    logFn("event", errorMessage);
    return {
      eventProcessed: false,
      errorMessage
    };
  }

  logFn("event", `A wild-eyed Druid appears before Champion${championId}!`);

  // Create the runed dagger
  const runedDagger = createRunedDagger();

  // Handle giving the runed dagger to the champion
  if (canChampionCarryMoreItems(champion)) {
    // Add the runed dagger directly
    champion.items.push(runedDagger);
    logFn("event", `The Druid hands Champion${championId} a Runed Dagger (+1 might)!`);
  } else {
    // Use the new utility for drop item decision
    const dropDecision = createDropItemDecision(
      championId,
      "Runed Dagger",
      champion,
      "The Druid offers a Runed Dagger (+1 might).",
      true,
      "Refuse the Runed Dagger"
    );

    const decision: Decision = await playerAgent.makeDecision(gameState, [], dropDecision.decisionContext, thinkingLogger);

    // Handle the decision using the utility
    const itemAcquired = handleDropItemDecision(
      decision,
      champion,
      runedDagger,
      tile,
      championId,
      "Runed Dagger",
      logFn
    );

    if (!itemAcquired) {
      logFn("event", `Champion${championId} refused the Runed Dagger.`);
    }
  }

  // Now place the Bear on the tile (the druid transforms)
  const bearCard = getMonsterCardById("bear");
  if (!bearCard) {
    const errorMessage = "Bear monster card not found";
    logFn("event", errorMessage);
    return {
      eventProcessed: false,
      errorMessage
    };
  }

  // Create a Monster object from the bear card
  const bear: Monster = {
    id: bearCard.id,
    name: bearCard.name,
    tier: bearCard.tier,
    icon: bearCard.icon,
    might: bearCard.might,
    fame: bearCard.fame,
    monsterType: bearCard.monsterType,
    resources: {
      food: bearCard.resources.food || 0,
      wood: bearCard.resources.wood || 0,
      ore: bearCard.resources.ore || 0,
      gold: bearCard.resources.gold || 0,
    },
  };

  // Place the bear on the tile
  tile.monster = bear;

  logFn("event", `As Champion${championId} prepares to leave, the wild-eyed Druid transforms into a mighty Bear! The Bear now guards this tile.`);

  return {
    eventProcessed: true,
    playersAffected: [player.name]
  };
} 