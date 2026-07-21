// BuildMight Goal - focuses on gathering resources to build might this turn
// Prioritizes resources needed for blacksmith usage, fletcher usage, temple, or mercenary

import { getTraderItemById } from "@/content/traderItems";
import { GameState } from "@/game/GameState";
import { DiceAction, HarvestDecision, TileAction } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { GameSettings } from "@/lib/GameSettings";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Decision, DecisionContext, GameLogEntry, Player, PlayerType, TurnContext } from "@/lib/types";
import { canAfford } from "../PlayerUtils";
import { chooseBestHarvestTiles } from "../RandomPlayerUtils";
import { Goal } from "./Goal";

export class BuildMight implements Goal {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return `${this.name} (Building Might)`;
  }

  getType(): PlayerType {
    return "random"; // Use same type as RandomPlayer for now
  }

  async makeStrategicAssessment(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    diceValues: number[],
    turnNumber: number,
    traderItems: readonly TraderCard[],
    thinkingLogger?: (content: string) => void,
  ): Promise<string | undefined> {
    const player = gameState.getCurrentPlayer();
    const mightOptions = this.analyzeMightOptions(player);
    return `Goal: Build Might. Best option: ${mightOptions.bestOption} (${mightOptions.description})`;
  }

  async decideDiceAction(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    turnContext: TurnContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<DiceAction> {
    const player = gameState.getCurrentPlayer();
    const remainingDice = turnContext.remainingDiceValues;

    if (remainingDice.length === 0) {
      throw new Error("No dice remaining for action");
    }

    // Choose a random die value
    const dieValue = remainingDice[Math.floor(Math.random() * remainingDice.length)];

    // Analyze what resources we need for might
    const mightOptions = this.analyzeMightOptions(player);

    const actions: DiceAction[] = [];

    // Try champion actions with preference for needed resource tiles
    if (player.champions.length > 0) {
      const championActions = this.generateMightResourceChampionActions(gameState, player.name, dieValue, mightOptions);
      actions.push(...championActions);
    }

    // Try harvest actions
    const harvestAction = this.generateMightResourceHarvestAction(gameState, player.name, dieValue);
    if (harvestAction) {
      actions.push(harvestAction);
    }

    // Fallback to any valid action if none found
    if (actions.length === 0 && player.champions.length > 0) {
      actions.push({
        actionType: "championAction",
        championAction: {
          diceValueUsed: dieValue,
          championId: player.champions[0].id,
          movementPathIncludingStartPosition: [player.champions[0].position],
        },
      });
    }

    if (actions.length === 0) {
      throw new Error("No valid actions available");
    }

    const chosenAction = actions[Math.floor(Math.random() * actions.length)];

    if (thinkingLogger) {
      thinkingLogger(`BuildMight: Will do ${chosenAction.actionType} with die ${dieValue} for ${mightOptions.bestOption}`);
    }

    return chosenAction;
  }

  async makeDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    decisionContext: DecisionContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<Decision> {
    // Random selection from available options
    const randomOption = decisionContext.options[Math.floor(Math.random() * decisionContext.options.length)];

    if (thinkingLogger) {
      thinkingLogger(`BuildMight: randomly chose: ${randomOption.id}`);
    }

    return { choice: randomOption.id };
  }

  async makeTraderDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    traderContext: TraderContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<TraderDecision> {
    // Simple trading strategy - random for now
    const playerResources = traderContext.playerResources;
    const availableItems = traderContext.availableItems;

    const actions: any[] = [];

    // Maybe buy an item if we have gold
    if (playerResources.gold > 0 && availableItems.length > 0 && Math.random() < 0.3) {
      const affordableItems = availableItems.filter(item => {
        const traderItem = getTraderItemById(item.id);
        return traderItem && playerResources.gold >= traderItem.cost;
      });

      if (affordableItems.length > 0) {
        const randomItem = affordableItems[Math.floor(Math.random() * affordableItems.length)];
        actions.push({
          type: "buyItem",
          itemId: randomItem.id
        });
      }
    }

    return { actions: actions };
  }

  async makeHarvestDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    playerName: string,
    savedDiceValues: number[],
    thinkingLogger?: (content: string) => void,
  ): Promise<HarvestDecision> {
    const player = gameState.getPlayer(playerName);
    if (!player) {
      throw new Error(`Player with name ${playerName} not found`);
    }

    const result: HarvestDecision = {
      harvestTiles: chooseBestHarvestTiles(gameState, playerName, savedDiceValues),
    };
    const buildingUsageDecision: any = {};

    // Priority: use buildings to gain might!

    // Use blacksmith if we can afford it and have one
    if (player.buildings.includes("blacksmith") &&
      canAfford(player, GameSettings.BLACKSMITH_USAGE_COST)) {
      buildingUsageDecision.useBlacksmith = true;

      if (thinkingLogger) {
        thinkingLogger(`BuildMight: Using blacksmith to gain might!`);
      }
    }

    // Use fletcher if we can afford it and have one
    if (player.buildings.includes("fletcher") &&
      canAfford(player, GameSettings.FLETCHER_USAGE_COST)) {
      buildingUsageDecision.useFletcher = true;

      if (thinkingLogger) {
        thinkingLogger(`BuildMight: Using fletcher to gain might!`);
      }
    }

    // Use market to convert resources if needed
    if (player.buildings.includes("market")) {
      const mightOptions = this.analyzeMightOptions(player);

      if (mightOptions.bestOption !== "none" && mightOptions.resourcesNeeded.length > 0) {
        const sellableResources = player.resources.food + player.resources.wood + player.resources.ore;
        if (sellableResources > GameSettings.MARKET_EXCHANGE_RATE) {
          const sellFood = player.resources.food > 2 && Math.random() < 0.5 ? Math.min(2, player.resources.food - 1) : 0;
          const sellWood = player.resources.wood > 2 && Math.random() < 0.7 ? Math.min(2, player.resources.wood - 1) : 0;
          const sellOre = 0; // Don't sell ore since we usually need it

          buildingUsageDecision.sellAtMarket = {
            food: sellFood,
            wood: sellWood,
            ore: sellOre
          };
        }
      }
    }

    if (Object.keys(buildingUsageDecision).length > 0) {
      result.buildingUsageDecision = buildingUsageDecision;
    }

    if (thinkingLogger && !result.buildingUsageDecision) {
      const mightOptions = this.analyzeMightOptions(player);
      thinkingLogger(`BuildMight: ${mightOptions.description}`);
    }

    return result;
  }

  private analyzeMightOptions(player: Player): {
    bestOption: string;
    description: string;
    resourcesNeeded: string[];
  } {
    const options = [];

    // Check blacksmith usage
    if (player.buildings.includes("blacksmith")) {
      const canUseBlacksmith = canAfford(player, GameSettings.BLACKSMITH_USAGE_COST);
      options.push({
        name: "blacksmith",
        affordable: canUseBlacksmith,
        needs: canUseBlacksmith ? [] : [
          ...(player.resources.ore < 3 ? [`${3 - player.resources.ore} ore`] : []),
          ...(player.resources.gold < 1 ? [`${1 - player.resources.gold} gold`] : [])
        ]
      });
    }

    // Check fletcher usage
    if (player.buildings.includes("fletcher")) {
      const canUseFletcher = canAfford(player, GameSettings.FLETCHER_USAGE_COST);
      options.push({
        name: "fletcher",
        affordable: canUseFletcher,
        needs: canUseFletcher ? [] : [
          ...(player.resources.wood < 3 ? [`${3 - player.resources.wood} wood`] : []),
          ...(player.resources.ore < 1 ? [`${1 - player.resources.ore} ore`] : [])
        ]
      });
    }

    // Check temple usage (need 2 fame, but we can't gather fame easily this turn)
    const canUseTemple = player.fame >= GameSettings.TEMPLE_FAME_COST;
    if (canUseTemple) {
      options.push({
        name: "temple",
        affordable: true,
        needs: []
      });
    }

    // Check mercenary usage (need 3 gold)
    const canUseMercenary = player.resources.gold >= GameSettings.MERCENARY_GOLD_COST;
    options.push({
      name: "mercenary",
      affordable: canUseMercenary,
      needs: canUseMercenary ? [] : [`${GameSettings.MERCENARY_GOLD_COST - player.resources.gold} gold`]
    });

    // Find best option
    const affordableOptions = options.filter(opt => opt.affordable);
    if (affordableOptions.length > 0) {
      return {
        bestOption: affordableOptions[0].name,
        description: `Can use ${affordableOptions[0].name} now`,
        resourcesNeeded: []
      };
    }

    // Find closest option
    const closestOption = options.reduce((best, current) => {
      return current.needs.length < best.needs.length ? current : best;
    }, options[0]);

    return {
      bestOption: closestOption ? closestOption.name : "none",
      description: closestOption ? `Need ${closestOption.needs.join(", ")} for ${closestOption.name}` : "No might options available",
      resourcesNeeded: closestOption ? closestOption.needs : []
    };
  }

  private generateMightResourceChampionActions(
    gameState: GameState,
    playerName: string,
    dieValue: number,
    mightOptions: { bestOption: string; resourcesNeeded: string[] }
  ): DiceAction[] {
    const player = gameState.getPlayer(playerName);
    if (!player) return [];

    const actions: DiceAction[] = [];

    // Determine what resources we need based on best might option
    const needsWood = mightOptions.resourcesNeeded.some(need => need.includes("wood"));
    const needsOre = mightOptions.resourcesNeeded.some(need => need.includes("ore"));
    const needsGold = mightOptions.resourcesNeeded.some(need => need.includes("gold"));

    for (const champion of player.champions) {
      // Look for needed resource tiles within movement range
      for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
          if (Math.abs(dRow) === Math.abs(dCol) && (dRow !== 0 || dCol !== 0)) continue; // Skip diagonals

          const newRow = champion.position.row + dRow * dieValue;
          const newCol = champion.position.col + dCol * dieValue;

          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const tile = gameState.getTile({ row: newRow, col: newCol });
            if (!tile) continue;

            // Prioritize tiles that give needed resources
            const isNeededResource =
              (needsWood && tile.resources && tile.resources.wood > 0) ||
              (needsOre && tile.resources && tile.resources.ore > 0) ||
              (needsGold && tile.resources && tile.resources.gold > 0) ||
              (tile.tileType === "mercenary") || (tile.tileType === "temple"); // Direct might sources

            if (isNeededResource || Math.random() < 0.3) { // Prefer needed resources, but allow some random movement
              actions.push({
                actionType: "championAction",
                championAction: {
                  diceValueUsed: dieValue,
                  championId: champion.id,
                  movementPathIncludingStartPosition: [
                    champion.position,
                    { row: newRow, col: newCol },
                  ],
                  tileAction: this.generateMightFocusedTileAction(player),
                },
              });
            }
          }
        }
      }
    }

    return actions;
  }

  private generateMightResourceHarvestAction(gameState: GameState, playerName: string, dieValue: number): DiceAction | null {
    const player = gameState.getPlayer(playerName);
    if (!player) return null;

    // Save the die for the harvest phase (tile choice happens then)
    return {
      actionType: "harvestAction",
      harvestAction: {
        diceValuesUsed: [dieValue],
      },
    };
  }

  private generateMightFocusedTileAction(player: Player): TileAction {
    const tileAction: TileAction = {
      claimTile: true,
    };

    // Always use trader
    tileAction.useTrader = true;

    // Use mercenary if we have gold (direct might gain)
    if (player.resources.gold >= GameSettings.MERCENARY_GOLD_COST) {
      tileAction.useMercenary = true;
    }

    // Use temple if we have fame (direct might gain)
    if (player.fame >= GameSettings.TEMPLE_FAME_COST) {
      tileAction.useTemple = true;
    }

    // Conquer valuable tiles if we can spare the fame
    if (player.fame >= GameSettings.CONQUER_FAME_COST) {
      tileAction.conquer = true;
    }

    return tileAction;
  }
}