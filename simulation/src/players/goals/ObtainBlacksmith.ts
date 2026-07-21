// ObtainBlacksmith Goal - focuses on gathering resources to build a blacksmith
// Prioritizes food and ore tiles, other decisions are random

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

export class ObtainBlacksmith implements Goal {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return `${this.name} (Obtaining Blacksmith)`;
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
    return `Goal: Obtain Blacksmith. Need ${GameSettings.BLACKSMITH_COST.food} food, ${GameSettings.BLACKSMITH_COST.ore} ore.`;
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

    // Prioritize actions that help get blacksmith resources
    const actions: DiceAction[] = [];

    // Try champion actions with preference for food/ore tiles
    if (player.champions.length > 0) {
      const championActions = this.generateFoodOreChampionActions(gameState, player.name, dieValue);
      actions.push(...championActions);
    }

    // Try harvest actions for food/ore
    const harvestAction = this.generateFoodOreHarvestAction(gameState, player.name, dieValue);
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
      thinkingLogger(`ObtainBlacksmith: Will do ${chosenAction.actionType} with die ${dieValue} to get food/ore`);
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
      thinkingLogger(`ObtainBlacksmith: randomly chose: ${randomOption.id}`);
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

    // Priority: build blacksmith if we can afford it!
    if (canAfford(player, GameSettings.BLACKSMITH_COST) && !player.buildings.includes("blacksmith")) {
      result.buildAction = "blacksmith" as any;

      if (thinkingLogger) {
        thinkingLogger(`ObtainBlacksmith: Building blacksmith! Goal achieved.`);
      }

      return result;
    }

    // Use market to convert resources to food/ore if needed
    if (player.buildings.includes("market")) {
      const needsFood = player.resources.food < GameSettings.BLACKSMITH_COST.food;
      const needsOre = player.resources.ore < GameSettings.BLACKSMITH_COST.ore;

      if ((needsFood || needsOre) && player.resources.wood > 0) {
        result.buildingUsageDecision = {
          sellAtMarket: {
            food: 0,
            wood: Math.min(2, player.resources.wood),
            ore: 0
          }
        };
      }
    }

    if (thinkingLogger) {
      const needFood = Math.max(0, GameSettings.BLACKSMITH_COST.food - player.resources.food);
      const needOre = Math.max(0, GameSettings.BLACKSMITH_COST.ore - player.resources.ore);
      thinkingLogger(`ObtainBlacksmith: Need ${needFood} food, ${needOre} ore for blacksmith`);
    }

    return result;
  }

  private generateFoodOreChampionActions(gameState: GameState, playerName: string, dieValue: number): DiceAction[] {
    const player = gameState.getPlayer(playerName);
    if (!player) return [];

    const actions: DiceAction[] = [];

    for (const champion of player.champions) {
      // Look for food and ore tiles within movement range
      for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
          if (Math.abs(dRow) === Math.abs(dCol) && (dRow !== 0 || dCol !== 0)) continue; // Skip diagonals

          const newRow = champion.position.row + dRow * dieValue;
          const newCol = champion.position.col + dCol * dieValue;

          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const tile = gameState.getTile({ row: newRow, col: newCol });
            if (!tile) continue;

            // Prioritize food and ore tiles
            const isFoodOrOre = tile.resources &&
              (tile.resources.food > 0 || tile.resources.ore > 0);

            if (isFoodOrOre || Math.random() < 0.3) { // Prefer food/ore, but allow some random movement
              actions.push({
                actionType: "championAction",
                championAction: {
                  diceValueUsed: dieValue,
                  championId: champion.id,
                  movementPathIncludingStartPosition: [
                    champion.position,
                    { row: newRow, col: newCol },
                  ],
                  tileAction: this.generateResourceFocusedTileAction(player),
                },
              });
            }
          }
        }
      }
    }

    return actions;
  }

  private generateFoodOreHarvestAction(gameState: GameState, playerName: string, dieValue: number): DiceAction | null {
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

  private generateResourceFocusedTileAction(player: Player): TileAction {
    const tileAction: TileAction = {
      claimTile: true, // Always claim for resources
    };

    // Always use trader
    tileAction.useTrader = true;

    // Use mercenary if we have gold and need might for conquest
    if (player.resources.gold >= GameSettings.MERCENARY_GOLD_COST) {
      tileAction.useMercenary = true;
    }

    // Use temple if we have fame
    if (player.fame >= GameSettings.TEMPLE_FAME_COST) {
      tileAction.useTemple = true;
    }

    return tileAction;
  }
}