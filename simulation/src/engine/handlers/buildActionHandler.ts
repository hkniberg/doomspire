import { BuildAction } from "@/lib/actionTypes";
import { Player, ResourceType } from "@/lib/types";
import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { canAfford, deductCost } from "@/players/PlayerUtils";
import { formatCost } from "@/lib/utils";

export interface BuildActionResult {
  actionSuccessful: boolean;
  reason?: string;
  resourcesSpent?: { food: number; wood: number; ore: number; gold: number };
}

type Cost = Record<ResourceType, number>;

/**
 * Get the effective cost of a build action, applying the Merchant Fair fate card if active
 * (costs reduced by 1 of each resource type, minimum 1 each).
 */
export function getEffectiveBuildCost(baseCost: Cost, gameState?: GameState): Cost {
  if (!gameState?.fateEffects.buildCostReduction) {
    return baseCost;
  }
  const reduce = (value: number) => (value > 0 ? Math.max(1, value - 1) : 0);
  return {
    food: reduce(baseCost.food),
    wood: reduce(baseCost.wood),
    ore: reduce(baseCost.ore),
    gold: reduce(baseCost.gold),
  };
}

export function handleBuildAction(
  player: Player,
  action: BuildAction,
  logFn: (type: string, content: string) => void,
  reasoning?: string,
  gameState?: GameState
): BuildActionResult {
  const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";

  if (action === "blacksmith") {
    return handleSimpleBuildingBuild(player, "blacksmith", getEffectiveBuildCost(GameSettings.BLACKSMITH_COST, gameState), logFn, reasoningText);
  } else if (action === "market") {
    return handleSimpleBuildingBuild(player, "market", getEffectiveBuildCost(GameSettings.MARKET_COST, gameState), logFn, reasoningText);
  } else if (action === "recruitChampion") {
    return handleChampionRecruitment(player, getEffectiveBuildCost(GameSettings.CHAMPION_COST, gameState), logFn, reasoningText);
  } else if (action === "buildBoat") {
    return handleBoatBuild(player, getEffectiveBuildCost(GameSettings.BOAT_COST, gameState), logFn, reasoningText);
  } else if (action === "chapel") {
    return handleChapelBuild(player, getEffectiveBuildCost(GameSettings.CHAPEL_COST, gameState), logFn, reasoningText);
  } else if (action === "upgradeChapelToMonastery") {
    return handleMonasteryBuild(player, getEffectiveBuildCost(GameSettings.MONASTERY_COST, gameState), logFn, reasoningText);
  } else if (action === "warshipUpgrade") {
    return handleWarshipUpgrade(player, getEffectiveBuildCost(GameSettings.WARSHIP_UPGRADE_COST, gameState), logFn, reasoningText);
  } else if (action === "fletcher") {
    return handleSimpleBuildingBuild(player, "fletcher", getEffectiveBuildCost(GameSettings.FLETCHER_COST, gameState), logFn, reasoningText);
  } else {
    return {
      actionSuccessful: false,
      reason: `Unknown building type: ${action}`
    };
  }
}

/**
 * Build a simple one-per-player building (blacksmith, market, fletcher)
 */
function handleSimpleBuildingBuild(
  player: Player,
  building: "blacksmith" | "market" | "fletcher",
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford ${building} - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  if (player.buildings.includes(building)) {
    logFn("system", `Cannot build ${building} - player already has one.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: `Already has ${building}`
    };
  }

  deductCost(player, cost);
  player.buildings.push(building);

  logFn("system", `Built a ${building} for ${formatCost(cost)}.${reasoningText}`);

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}

function handleChampionRecruitment(
  player: Player,
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  // Check if player can recruit a champion
  const currentChampionCount = player.champions.length;

  if (currentChampionCount >= GameSettings.MAX_CHAMPIONS_PER_PLAYER) {
    logFn("system", `Cannot recruit champion - already have maximum of ${GameSettings.MAX_CHAMPIONS_PER_PLAYER} champions.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Maximum champions reached"
    };
  }

  const championId = currentChampionCount + 1; // Next champion ID (starting champion has id 1)

  // Check if player can afford the champion
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford champion ${championId} - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  // Deduct resources
  deductCost(player, cost);

  // Add new champion to player's home tile
  const newChampion = {
    id: championId,
    position: player.homePosition,
    playerName: player.name,
    items: [],
    followers: [],
  };

  player.champions.push(newChampion);

  logFn(
    "system",
    `Recruited champion ${championId} for ${formatCost(cost)}.${reasoningText}`
  );

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}

function handleBoatBuild(
  player: Player,
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  // Check if player can afford boat
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford boat - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  // Check if player already has maximum boats (max 2 boats total)
  const currentBoatCount = player.boats.length;
  if (currentBoatCount >= GameSettings.MAX_BOATS_PER_PLAYER) {
    logFn("system", `Cannot build boat - already have maximum of ${GameSettings.MAX_BOATS_PER_PLAYER} boats.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Maximum boats reached"
    };
  }

  // Deduct resources
  deductCost(player, cost);

  // Add new boat to player's boats array
  const newBoatId = currentBoatCount + 1;
  const newBoat = {
    id: newBoatId,
    playerName: player.name,
    position: player.boats.length > 0 ? player.boats[0].position : ("nw" as const), // Start in same position as first boat
  };

  player.boats.push(newBoat);

  logFn(
    "system",
    `Built boat ${newBoatId} for ${formatCost(cost)}.${reasoningText}`
  );

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}

function handleChapelBuild(
  player: Player,
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  // Check if player can afford chapel
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford chapel - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  // Check if player already has a chapel or monastery (max 1 per player)
  const hasChapel = player.buildings.includes("chapel");
  const hasMonastery = player.buildings.includes("monastery");
  if (hasChapel || hasMonastery) {
    logFn("system", `Cannot build chapel - player already has a chapel or monastery.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Already has chapel or monastery"
    };
  }

  // Deduct resources
  deductCost(player, cost);

  // Add chapel to player's buildings
  player.buildings.push("chapel");

  // Gain fame immediately
  player.fame += GameSettings.CHAPEL_FAME_REWARD;

  logFn(
    "system",
    `Built a chapel for ${formatCost(cost)}. Gained ${GameSettings.CHAPEL_FAME_REWARD} Fame.${reasoningText}`
  );

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}

function handleMonasteryBuild(
  player: Player,
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  // Check if player can afford monastery
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford monastery - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  // Check if player has a chapel (monastery can only be built if chapel exists)
  const hasChapel = player.buildings.includes("chapel");
  if (!hasChapel) {
    logFn("system", `Cannot build monastery - requires a chapel first.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "No chapel to upgrade"
    };
  }

  // Check if player already has a monastery (max 1 per player)
  const hasMonastery = player.buildings.includes("monastery");
  if (hasMonastery) {
    logFn("system", `Cannot build monastery - player already has one.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Already has monastery"
    };
  }

  // Deduct resources
  deductCost(player, cost);

  // Remove chapel and add monastery (monastery replaces chapel)
  const chapelIndex = player.buildings.indexOf("chapel");
  if (chapelIndex !== -1) {
    player.buildings.splice(chapelIndex, 1);
  }
  player.buildings.push("monastery");

  // Gain fame immediately
  player.fame += GameSettings.MONASTERY_FAME_REWARD;

  logFn(
    "system",
    `Built a monastery for ${formatCost(cost)}. Upgraded chapel to monastery. Gained ${GameSettings.MONASTERY_FAME_REWARD} Fame.${reasoningText}`
  );

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}

function handleWarshipUpgrade(
  player: Player,
  cost: Cost,
  logFn: (type: string, content: string) => void,
  reasoningText: string
): BuildActionResult {
  // Check if player can afford warship upgrade
  if (!canAfford(player, cost)) {
    logFn("system", `Cannot afford warship upgrade - requires ${formatCost(cost)}.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Insufficient resources"
    };
  }

  // Check if player already has warship upgrade (max 1 per player)
  const hasWarshipUpgrade = player.buildings.includes("warshipUpgrade");
  if (hasWarshipUpgrade) {
    logFn("system", `Cannot build warship upgrade - player already has one.${reasoningText}`);
    return {
      actionSuccessful: false,
      reason: "Already has warship upgrade"
    };
  }

  // Deduct resources
  deductCost(player, cost);

  // Add warship upgrade to player's buildings
  player.buildings.push("warshipUpgrade");

  logFn(
    "system",
    `Built warship upgrade for ${formatCost(cost)}. All boats are now warships.${reasoningText}`
  );

  return {
    actionSuccessful: true,
    resourcesSpent: cost
  };
}
