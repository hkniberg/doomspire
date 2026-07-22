import { GameState } from "@/game/GameState";
import { EventCardResult } from "@/lib/types";

/**
 * Handle the Blessing of the Lonesome event card.
 * Lords with a lone knight gain +1 might; those with two or more knights gain +1 fame.
 * The blessing turns into a curse: the dice tax is doubled next round.
 */
export function handleBlessingOfTheLonesome(
  gameState: GameState,
  logFn: (type: string, content: string) => void
): EventCardResult {
  logFn("event", "A blessing washes over the lonesome...");

  for (const player of gameState.players) {
    if (player.champions.length <= 1) {
      player.might += 1;
      logFn("event", `${player.name} has a lone knight and gains 1 might`);
    } else {
      player.fame += 1;
      logFn("event", `${player.name} has ${player.champions.length} knights and gains 1 fame`);
    }
  }

  gameState.doubleFoodTaxNextRound = true;
  logFn("event", "The blessing turns into a curse: the dice tax is doubled next round!");

  return {
    eventProcessed: true,
    playersAffected: gameState.players.map((p) => p.name)
  };
}
