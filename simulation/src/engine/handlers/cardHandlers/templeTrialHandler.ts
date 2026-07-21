import { GameState } from "@/game/GameState";
import { DecisionOption, EventCardResult, GameLogEntry, Player, ResourceType } from "@/lib/types";
import { PlayerAgent } from "@/players/PlayerAgent";

/**
 * Handle the Temple Trial event card.
 * An ancient temple priest tests the champion's worthiness:
 * - Make an offering: give 1 resource to any player, gain 1 fame.
 * - Commit sacrilege: take 1 resource from any player, lose 1 fame.
 * - (Or do nothing, if neither is possible.)
 */
export async function handleTempleTrial(
  gameState: GameState,
  player: Player,
  playerAgent: PlayerAgent,
  logFn: (type: string, content: string) => void,
  thinkingLogger?: (content: string) => void
): Promise<EventCardResult> {
  logFn("event", "An ancient temple priest tests your worthiness before the gods!");

  const otherPlayers = gameState.players.filter((p) => p.name !== player.name);
  const ownResourceTypes = (["food", "wood", "ore", "gold"] as ResourceType[]).filter(
    (type) => player.resources[type] > 0
  );

  // Build combined options: offering (give own resource to a player) or sacrilege (take from a player)
  const options: DecisionOption[] = [];

  for (const other of otherPlayers) {
    for (const type of ownResourceTypes) {
      options.push({
        id: `offer_${other.name}_${type}`,
        description: `Offering: give 1 ${type} to ${other.name} (gain 1 fame)`
      });
    }
    for (const type of ["food", "wood", "ore", "gold"] as ResourceType[]) {
      if (other.resources[type] > 0) {
        options.push({
          id: `sacrilege_${other.name}_${type}`,
          description: `Sacrilege: take 1 ${type} from ${other.name} (lose 1 fame)`
        });
      }
    }
  }

  if (options.length === 0) {
    logFn("event", "Neither an offering nor sacrilege is possible - the priest shrugs and wanders off.");
    return { eventProcessed: true };
  }

  options.push({ id: "decline", description: "Decline the trial (nothing happens)" });

  let choice = "decline";
  try {
    const decision = await playerAgent.makeDecision(gameState, [] as readonly GameLogEntry[], {
      description: "Temple Trial: make an offering (+1 fame) or commit sacrilege (-1 fame)?",
      options
    }, thinkingLogger);
    choice = options.some((o) => o.id === decision.choice) ? decision.choice : "decline";
  } catch (error) {
    choice = "decline";
  }

  if (choice === "decline") {
    logFn("event", `${player.name} declines the temple trial.`);
    return { eventProcessed: true };
  }

  const [mode, targetName, resourceType] = choice.split("_") as [string, string, ResourceType];
  const target = gameState.getPlayer(targetName);
  if (!target) {
    return { eventProcessed: true };
  }

  if (mode === "offer") {
    player.resources[resourceType] -= 1;
    target.resources[resourceType] += 1;
    player.fame += 1;
    logFn("event", `${player.name} makes an offering: gives 1 ${resourceType} to ${target.name} and gains 1 fame.`);
  } else {
    target.resources[resourceType] -= 1;
    player.resources[resourceType] += 1;
    player.fame = Math.max(0, player.fame - 1);
    logFn("event", `${player.name} commits sacrilege: takes 1 ${resourceType} from ${target.name} and loses 1 fame.`);
  }

  return {
    eventProcessed: true,
    playersAffected: [player.name, target.name]
  };
}
