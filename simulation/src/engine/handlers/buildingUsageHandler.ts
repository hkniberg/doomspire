import { Player, ResourceType } from "@/lib/types";
import { HarvestDecision } from "@/lib/actionTypes";
import { handleBuildAction } from "./buildActionHandler";
import { GameSettings } from "@/lib/GameSettings";
import { canAfford, deductCost } from "@/players/PlayerUtils";
import { formatCost } from "@/lib/utils";

export interface BuildingUsageResult {
  blacksmithUsed: boolean;
  marketUsed: boolean;
  fletcherUsed: boolean;
  buildActionPerformed?: string;
  totalGoldGained: number;
  totalResourcesSold: number;
  failedActions: Array<{ action: string; reason: string }>;
}

/**
 * Whether the player has anything to decide about buildings during the harvest phase:
 * usable buildings, or affordable build actions.
 */
export function hasHarvestPhaseBuildingOptions(player: Player): boolean {
  const hasUsableBuilding =
    player.buildings.includes("blacksmith") ||
    player.buildings.includes("market") ||
    player.buildings.includes("fletcher");
  return hasUsableBuilding || checkAvailableBuildActions(player).length > 0;
}

/**
 * Apply the building parts of a player's harvest phase decision:
 * building usage first, then one build action.
 */
export function handleBuildingUsage(
  player: Player,
  buildingDecision: HarvestDecision,
  gameState: any,
  logFn: (type: string, content: string) => void,
): BuildingUsageResult {
  const result: BuildingUsageResult = {
    blacksmithUsed: false,
    marketUsed: false,
    fletcherUsed: false,
    totalGoldGained: 0,
    totalResourcesSold: 0,
    failedActions: []
  };

  const hasBlacksmith = player.buildings.includes("blacksmith");
  const hasMarket = player.buildings.includes("market");
  const hasFletcher = player.buildings.includes("fletcher");

  // Collect all actions for consolidated logging
  const logParts: string[] = [];

  // Process building usage first.
  // The market is processed before the blacksmith and fletcher: gold gained from selling
  // can fund a might purchase in the same harvest phase, while might purchases never
  // produce anything a sale could depend on. Processing the market last would silently
  // break "sell resources, then buy might" plans.
  if (buildingDecision.buildingUsageDecision) {
    const usageDecision = buildingDecision.buildingUsageDecision;

    // Process market usage. An all-zero sellAtMarket object is treated as "not using the
    // market" (a no-op, not a failure) - AI players often fill in the optional field with zeros.
    const wantsToSell = usageDecision.sellAtMarket !== undefined
      && Object.values(usageDecision.sellAtMarket).some(amount => amount > 0);
    if (wantsToSell) {
      if (hasMarket) {
        // The market sells resources at 2:1 for gold. Different resource types can be POOLED:
        // e.g. selling 3 food and 1 wood yields 2 gold. Only the converted resources are deducted;
        // an odd leftover resource is kept by the player.
        const offered: Array<{ type: ResourceType; amount: number }> = [];
        for (const [resourceType, amount] of Object.entries(usageDecision.sellAtMarket!)) {
          if (amount > 0 && resourceType !== "gold") {
            const resourceKey = resourceType as ResourceType;
            const actualAmount = Math.min(amount, player.resources[resourceKey]);
            if (actualAmount > 0) {
              offered.push({ type: resourceKey, amount: actualAmount });
            }
          }
        }

        const totalOffered = offered.reduce((sum, o) => sum + o.amount, 0);
        const goldGained = Math.floor(totalOffered / GameSettings.MARKET_EXCHANGE_RATE);
        let toDeduct = goldGained * GameSettings.MARKET_EXCHANGE_RATE;

        if (goldGained > 0) {
          let totalSold = 0;
          const resourcesSoldDetails: string[] = [];

          for (const { type, amount } of offered) {
            const deductAmount = Math.min(amount, toDeduct);
            if (deductAmount > 0) {
              player.resources[type] -= deductAmount;
              toDeduct -= deductAmount;
              totalSold += deductAmount;
              const resourceName = type.charAt(0).toUpperCase() + type.slice(1);
              resourcesSoldDetails.push(`${deductAmount} ${resourceName}`);
            }
          }

          player.resources.gold += goldGained;
          result.marketUsed = true;
          result.totalGoldGained += goldGained;
          result.totalResourcesSold += totalSold;
          logParts.push(`Used market: sold ${resourcesSoldDetails.join(" + ")} for ${goldGained} Gold`);
        } else {
          result.failedActions.push({
            action: "market",
            reason: `Need at least ${GameSettings.MARKET_EXCHANGE_RATE} resources to sell`
          });
        }
      } else {
        result.failedActions.push({
          action: "market",
          reason: "No market building"
        });
      }
    }

    // Process blacksmith usage
    if (usageDecision.useBlacksmith) {
      if (hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_USAGE_COST)) {
        // Deduct resources and gain might
        deductCost(player, GameSettings.BLACKSMITH_USAGE_COST);
        player.might += 1;

        result.blacksmithUsed = true;
        logParts.push(`Used blacksmith: paid ${formatCost(GameSettings.BLACKSMITH_USAGE_COST)}, gained 1 Might`);
      } else {
        result.failedActions.push({
          action: "blacksmith",
          reason: hasBlacksmith ? `Insufficient resources (need ${formatCost(GameSettings.BLACKSMITH_USAGE_COST)})` : "No blacksmith building"
        });
      }
    }

    // Process fletcher usage
    if (usageDecision.useFletcher) {
      if (hasFletcher && canAfford(player, GameSettings.FLETCHER_USAGE_COST)) {
        // Deduct resources and gain might
        deductCost(player, GameSettings.FLETCHER_USAGE_COST);
        player.might += 1;

        result.fletcherUsed = true;
        logParts.push(`Used fletcher: paid ${formatCost(GameSettings.FLETCHER_USAGE_COST)}, gained 1 Might`);
      } else {
        result.failedActions.push({
          action: "fletcher",
          reason: hasFletcher ? `Insufficient resources (need ${formatCost(GameSettings.FLETCHER_USAGE_COST)})` : "No fletcher building"
        });
      }
    }
  }

  // Process build action (happens after building usage)
  if (buildingDecision.buildAction) {
    try {
      const buildResult = handleBuildAction(player, buildingDecision.buildAction, () => { }, undefined, gameState); // Don't log individually
      if (buildResult.actionSuccessful) {
        result.buildActionPerformed = buildingDecision.buildAction;

        // Get build cost details for logging
        const buildCostDetails = getBuildCostDetails(buildingDecision.buildAction, player);
        logParts.push(`Built ${buildingDecision.buildAction}${buildCostDetails ? ` for ${buildCostDetails}` : ""}`);

        // Track statistics
        if (player.statistics) {
          player.statistics.buildActions += 1;
        }
      } else {
        result.failedActions.push({
          action: `build_${buildingDecision.buildAction}`,
          reason: buildResult.reason || "Build action failed"
        });
      }
    } catch (error) {
      result.failedActions.push({
        action: `build_${buildingDecision.buildAction}`,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Failed actions are logged too, so silently dropped plans are visible in the game log
  for (const failed of result.failedActions) {
    logParts.push(`FAILED ${failed.action}: ${failed.reason}`);
  }

  // Create consolidated log entry if any actions were performed
  if (logParts.length > 0) {
    let consolidatedMessage = logParts.join(". ");

    // Add reasoning if provided
    if (buildingDecision.reasoning) {
      consolidatedMessage += `. Reason: ${buildingDecision.reasoning}`;
    }

    logFn("building", consolidatedMessage);
  }

  return result;
}

/**
 * Get the cost details for a build action for logging purposes
 */
function getBuildCostDetails(buildAction: string, player?: Player): string {
  switch (buildAction) {
    case "blacksmith":
      return formatCost(GameSettings.BLACKSMITH_COST);
    case "market":
      return formatCost(GameSettings.MARKET_COST);
    case "fletcher":
      return formatCost(GameSettings.FLETCHER_COST);
    case "chapel":
      return formatCost(GameSettings.CHAPEL_COST);
    case "upgradeChapelToMonastery":
      return formatCost(GameSettings.MONASTERY_COST);
    case "recruitChampion":
      return formatCost(GameSettings.CHAMPION_COST);
    case "buildBoat":
      return formatCost(GameSettings.BOAT_COST);
    case "warshipUpgrade":
      return formatCost(GameSettings.WARSHIP_UPGRADE_COST);
    default:
      return "";
  }
}

function checkAvailableBuildActions(player: Player): string[] {
  const availableActions: string[] = [];

  // Check various build actions using canAfford utility and GameSettings
  const hasBlacksmith = player.buildings.includes("blacksmith");
  if (!hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_COST)) {
    availableActions.push("blacksmith");
  }

  const hasMarket = player.buildings.includes("market");
  if (!hasMarket && canAfford(player, GameSettings.MARKET_COST)) {
    availableActions.push("market");
  }

  const hasFletcher = player.buildings.includes("fletcher");
  if (!hasFletcher && canAfford(player, GameSettings.FLETCHER_COST)) {
    availableActions.push("fletcher");
  }

  const hasChapel = player.buildings.includes("chapel");
  const hasMonastery = player.buildings.includes("monastery");
  if (!hasChapel && !hasMonastery && canAfford(player, GameSettings.CHAPEL_COST)) {
    availableActions.push("chapel");
  }

  if (hasChapel && !hasMonastery && canAfford(player, GameSettings.MONASTERY_COST)) {
    availableActions.push("upgradeChapelToMonastery");
  }

  // FIXED: Use fixed cost as per game rules (always 3 Food, 3 Gold, 1 Ore)
  const currentChampionCount = player.champions.length;
  if (currentChampionCount < GameSettings.MAX_CHAMPIONS_PER_PLAYER && canAfford(player, GameSettings.CHAMPION_COST)) {
    availableActions.push("recruitChampion");
  }

  const currentBoatCount = player.boats.length;
  if (currentBoatCount < GameSettings.MAX_BOATS_PER_PLAYER && canAfford(player, GameSettings.BOAT_COST)) {
    availableActions.push("buildBoat");
  }

  const hasWarshipUpgrade = player.buildings.includes("warshipUpgrade");
  if (!hasWarshipUpgrade && canAfford(player, GameSettings.WARSHIP_UPGRADE_COST)) {
    availableActions.push("warshipUpgrade");
  }

  return availableActions;
} 