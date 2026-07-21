// Lords of Doomspire Player Interface

import { GameState } from "@/game/GameState";
import { DiceAction, HarvestDecision } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Decision, DecisionContext, GameLogEntry, PlayerType, TurnContext } from "@/lib/types";

export interface PlayerAgent {
  getName(): string;
  getType(): PlayerType;

  /**
   * Strategic assessment of the current game situation
   * @param gameState Current game state
   * @param gameLog Game log entries for this session
   * @param diceValues The dice values rolled for this turn
   * @param turnNumber Current turn number
   * @param traderItems Available trader items
   * @param thinkingLogger Optional logger for AI thinking process
   * @returns Strategic assessment text or undefined if not supported
   */
  makeStrategicAssessment?(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    diceValues: number[],
    turnNumber: number,
    traderItems: readonly TraderCard[],
    thinkingLogger?: (content: string) => void,
  ): Promise<string | undefined>;

  /**
   * Choose a dice action during the movement phase
   * @param gameState Current game state
   * @param gameLog Game log entries for this session
   * @param turnContext Context about the current turn (remaining dice, etc.)
   * @param thinkingLogger Optional logger for AI thinking process
   * @returns The chosen dice action
   */
  decideDiceAction(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    turnContext: TurnContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<DiceAction>;

  /**
   * Make a decision when prompted with specific options
   * @param gameState Current game state
   * @param gameLog Game log entries for this session
   * @param decisionContext Context about the decision to make
   * @param thinkingLogger Optional logger for AI thinking process
   * @returns The chosen decision
   */
  makeDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    decisionContext: DecisionContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<Decision>;

  /**
   * Make a decision about trader interactions
   * @param gameState Current game state
   * @param gameLog Game log entries for this session
   * @param traderContext Context about the trader interaction
   * @param thinkingLogger Optional logger for AI thinking process
   * @returns The chosen trader decision
   */
  makeTraderDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    traderContext: TraderContext,
    thinkingLogger?: (content: string) => void,
  ): Promise<TraderDecision>;

  /**
   * Make the harvest phase decision: which tiles to harvest from (using dice saved
   * during the move phase), which buildings to use, and what to build.
   * @param gameState Current game state
   * @param gameLog Game log entries for this session
   * @param playerName Name of the player making the decision
   * @param savedDiceValues Dice values saved for harvesting during the move phase (may be empty)
   * @param thinkingLogger Optional logger for AI thinking process
   * @returns HarvestDecision with harvest tiles, building usage, and build action
   */
  makeHarvestDecision(
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    playerName: string,
    savedDiceValues: number[],
    thinkingLogger?: (content: string) => void,
  ): Promise<HarvestDecision>;
}
