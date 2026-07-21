// GoalPlayer - A smarter variant of RandomPlayer that uses goal-based decision making
// Routes all decisions through specific goals based on current game state

import { GameState } from "@/game/GameState";
import { DiceAction, HarvestDecision } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { GameSettings } from "@/lib/GameSettings";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Decision, DecisionContext, GameLogEntry, PlayerType, TurnContext } from "@/lib/types";
import { PlayerAgent } from "./PlayerAgent";
import { Goal } from "./goals/Goal";
import { ObtainBlacksmith } from "./goals/ObtainBlacksmith";
import { BuildMight } from "./goals/BuildMight";

export class GoalPlayer implements PlayerAgent {
  private name: string;
  private obtainBlacksmithGoal: Goal;
  private buildMightGoal: Goal;

  constructor(name: string) {
    this.name = name;
    this.obtainBlacksmithGoal = new ObtainBlacksmith(name);
    this.buildMightGoal = new BuildMight(name);
  }

  getName(): string {
    return this.name;
  }

  getType(): PlayerType {
    return "random"; // Note: using "random" type since GoalPlayer isn't a distinct PlayerType in the system
  }

  /**
   * Select the appropriate goal based on current game state.
   * Pass playerName when the decision may happen outside this player's own turn
   * (e.g. the parallel harvest phase, where getCurrentPlayer() is not reliable).
   */
  private selectCurrentGoal(gameState: GameState, playerName?: string): Goal {
    const player = (playerName ? gameState.getPlayer(playerName) : undefined) ?? gameState.getCurrentPlayer();

    // If player doesn't have blacksmith and can't afford it, focus on obtaining it
    const hasBlacksmith = player.buildings.includes("blacksmith");
    if (!hasBlacksmith) {
      return this.obtainBlacksmithGoal;
    }

    // If player has blacksmith, focus on building might
    return this.buildMightGoal;
  }

  async makeStrategicAssessment(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    diceValues: number[],
    turnNumber: number,
    traderItems: readonly TraderCard[],
    thinkingLogger?: (content: string) => void,
  ): Promise<string | undefined> {
    const currentGoal = this.selectCurrentGoal(gameState);
    if (currentGoal.makeStrategicAssessment) {
      return await currentGoal.makeStrategicAssessment(
        gameState,
        gameLog,
        diceValues,
        turnNumber,
        traderItems,
        thinkingLogger
      );
    }
    return undefined;
  }

  async decideDiceAction(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    turnContext: TurnContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<DiceAction> {
    const currentGoal = this.selectCurrentGoal(gameState);

    if (thinkingLogger) {
      const player = gameState.getCurrentPlayer();
      const hasBlacksmith = player.buildings.includes("blacksmith");
      thinkingLogger(`GoalPlayer: Using ${hasBlacksmith ? 'BuildMight' : 'ObtainBlacksmith'} goal`);
    }

    return await currentGoal.decideDiceAction(gameState, gameLog, turnContext, thinkingLogger);
  }

  async makeDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    decisionContext: DecisionContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<Decision> {
    const currentGoal = this.selectCurrentGoal(gameState);
    return await currentGoal.makeDecision(gameState, gameLog, decisionContext, thinkingLogger);
  }

  async makeTraderDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    traderContext: TraderContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<TraderDecision> {
    const currentGoal = this.selectCurrentGoal(gameState);
    return await currentGoal.makeTraderDecision(gameState, gameLog, traderContext, thinkingLogger);
  }

  async makeHarvestDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    playerName: string,
    savedDiceValues: number[],
    thinkingLogger?: (content: string) => void,
  ): Promise<HarvestDecision> {
    const currentGoal = this.selectCurrentGoal(gameState, playerName);
    return await currentGoal.makeHarvestDecision(gameState, gameLog, playerName, savedDiceValues, thinkingLogger);
  }
}