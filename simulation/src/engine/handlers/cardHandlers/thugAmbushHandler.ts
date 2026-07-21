import { getMonsterCardById } from "@/content/monsterCards";
import { GameState } from "@/game/GameState";
import { EventCardResult, Monster, Player } from "@/lib/types";
import { resolveImmediateCombat } from "../combatHandler";

/**
 * Roll a D3 (returns 1, 2, or 3 with equal probability like the game rules)
 */
function rollD3(): number {
  const outcomes = [1, 1, 2, 2, 3, 3];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

/**
 * Handle the Thug Ambush event card
 */
export async function handleThugAmbush(
  gameState: GameState,
  currentPlayer: Player,
  championId: number,
  logFn: (type: string, content: string) => void
): Promise<EventCardResult> {
  logFn("event", "Thug Ambush! Rolling for outcome...");

  const roll = rollD3();
  logFn("event", `Rolled ${roll}`);

  const champion = gameState.getChampion(currentPlayer.name, championId);
  if (!champion) {
    return {
      eventProcessed: false,
      errorMessage: `Champion ${championId} not found for ${currentPlayer.name}`
    };
  }

  switch (roll) {
    case 1:
      // They steal 1 gold (if you have any)
      if (currentPlayer.resources.gold > 0) {
        currentPlayer.resources.gold -= 1;
        logFn("event", `Thugs steal 1 gold from ${currentPlayer.name}`);
        return {
          eventProcessed: true,
          playersAffected: [currentPlayer.name],
          resourcesChanged: {
            [currentPlayer.name]: { gold: -1 }
          }
        };
      } else {
        logFn("event", `Thugs try to steal gold from ${currentPlayer.name}, but they have none`);
        return {
          eventProcessed: true,
          playersAffected: [currentPlayer.name]
        };
      }

    case 2:
      // Fight bandit might 3, if you win, gain 1 fame and 2 gold
      const banditCard = getMonsterCardById("bandit");
      if (!banditCard) {
        return {
          eventProcessed: false,
          errorMessage: "Bandit monster card not found"
        };
      }

      // Create a bandit monster for immediate combat
      const bandit: Monster = {
        id: banditCard.id,
        name: banditCard.name,
        tier: banditCard.tier,
        icon: banditCard.icon,
        might: banditCard.might,
        fame: banditCard.fame,
        monsterType: banditCard.monsterType,
        resources: {
          food: banditCard.resources.food || 0,
          wood: banditCard.resources.wood || 0,
          ore: banditCard.resources.ore || 0,
          gold: banditCard.resources.gold || 0,
        },
      };

      logFn("event", `${currentPlayer.name}'s Champion ${championId} must fight a bandit!`);

      // Use immediate combat without placing the monster on the board
      const combatResult = await resolveImmediateCombat(
        gameState,
        bandit,
        currentPlayer,
        championId,
        logFn
      );

      if (combatResult.victory) {
        return {
          eventProcessed: true,
          playersAffected: [currentPlayer.name],
          resourcesChanged: {
            [currentPlayer.name]: { gold: 2 }
          }
        };
      } else {
        return {
          eventProcessed: true,
          playersAffected: [currentPlayer.name]
        };
      }

    case 3:
      // You scare them off and gain 1 fame
      currentPlayer.fame += 1;
      logFn("event", `${currentPlayer.name} scares off the thugs and gains 1 fame`);
      return {
        eventProcessed: true,
        playersAffected: [currentPlayer.name]
      };

    default:
      return {
        eventProcessed: false,
        errorMessage: `Unexpected roll result: ${roll}`
      };
  }
} 