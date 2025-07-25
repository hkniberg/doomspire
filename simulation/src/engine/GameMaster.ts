// Lords of Doomspire Game Master

import { GameState, rollMultipleD3 } from "../game/GameState";
import { GameAction } from "../lib/actionTypes";
import { CARDS, GameDecks } from "../lib/cards";
import { ActionResult, DecisionContext, GameLogEntry, Player, TurnContext } from "../players/Player";
import { checkVictory } from "./actions/checkVictory";
import { executeHarvest } from "./actions/executeHarvest";
import { executeBoatMove, executeChampionMove } from "./actions/executeMove";
import { CombatResolver } from "./CombatResolver";
import { TileArrivalHandler } from "./TileArrivalHandler";

export type GameMasterState = "setup" | "playing" | "finished";

export interface GameMasterConfig {
  players: Player[];
  maxRounds?: number; // Optional limit for testing
  startingValues?: { fame?: number; might?: number }; // Optional starting fame and might
}

export class GameMaster {
  private gameState: GameState;
  private players: Player[];
  private masterState: GameMasterState;
  private maxRounds: number;
  private gameLog: GameLogEntry[];
  private gameDecks: GameDecks;
  private tileArrivalHandler: TileArrivalHandler;

  constructor(config: GameMasterConfig) {
    // Create GameState with the correct player names from the start
    const playerNames = config.players.map((player) => player.getName());
    this.gameState = GameState.createWithPlayerNames(playerNames, config.startingValues);
    this.players = config.players;
    this.masterState = "setup";
    this.maxRounds = config.maxRounds || 100; // Default limit to prevent infinite games
    this.gameLog = [];
    this.gameDecks = new GameDecks(CARDS);
    this.tileArrivalHandler = new TileArrivalHandler(new CombatResolver());
  }

  /**
   * Start the game session
   */
  public start(): void {
    if (this.masterState !== "setup") {
      throw new Error(`Cannot start game: session is in state ${this.masterState}`);
    }

    console.log("=== Lords of Doomspire Game Session Starting ===");
    console.log(`Players: ${this.players.map((p) => p.getName()).join(", ")}`);
    console.log("================================================");

    this.masterState = "playing";

    // Add initial system log entry
    this.addLogEntry({
      round: 0,
      playerId: -1,
      playerName: "System",
      type: "system",
      content: `Game started with players: ${this.players.map((p) => p.getName()).join(", ")}`,
    });
  }

  /**
   * Execute a single turn for the current player using the new Game Master pattern
   */
  public async executeTurn(): Promise<void> {
    if (this.masterState !== "playing") {
      throw new Error(`Cannot execute turn: session is in state ${this.masterState}`);
    }

    const currentPlayer = this.players[this.gameState.currentPlayerIndex];
    const playerId = this.gameState.getCurrentPlayer().id;

    console.log(`\n--- ${currentPlayer.getName()}'s Turn (Round ${this.gameState.currentRound}) ---`);

    // Step 1: Roll dice for player
    const additionalChampions = this.gameState.getCurrentPlayer().champions.length - 1;
    const diceCount = 2 + additionalChampions;
    const diceRolls = rollMultipleD3(diceCount);

    console.log(`${currentPlayer.getName()} rolled: ${diceRolls.join(", ")}`);
    this.addLogEntry({
      round: this.gameState.currentRound,
      playerId: playerId,
      playerName: currentPlayer.getName(),
      type: "system",
      content: `Rolled dice: ${diceRolls.join(", ")}`,
    });

    // Step 2: Ask player for strategic assessment (strategic reflection) - now with dice context
    try {
      const strategicAssessment = await currentPlayer.makeStrategicAssessment(this.gameState, this.gameLog, diceRolls);
      if (strategicAssessment) {
        console.log(`${currentPlayer.getName()}'s assessment: ${strategicAssessment}`);
        this.addLogEntry({
          round: this.gameState.currentRound,
          playerId: playerId,
          playerName: currentPlayer.getName(),
          type: "assessment",
          content: strategicAssessment,
        });
      }
    } catch (error) {
      console.error(`Error getting strategic assessment from ${currentPlayer.getName()}:`, error);
    }

    // Step 3: For each die, ask player to decide action and execute it
    let remainingDice = [...diceRolls];
    let currentState = this.gameState;

    for (let dieIndex = 0; dieIndex < diceRolls.length; dieIndex++) {
      const dieValue = diceRolls[dieIndex];

      try {
        // Create turn context for this die
        const turnContext: TurnContext = {
          turnNumber: this.gameState.currentRound,
          diceRolled: diceRolls,
          remainingDiceValues: remainingDice,
        };

        // Ask player what they want to do with this die
        const diceAction = await currentPlayer.decideDiceAction(currentState, this.gameLog, turnContext);

        console.log(`Die ${dieValue}: ${this.actionToString(diceAction)}`);

        // Execute the action
        const result = await this.executeAction(currentState, diceAction, playerId, [dieValue], currentPlayer);

        // Log the action and result
        this.addLogEntry({
          round: this.gameState.currentRound,
          playerId: playerId,
          playerName: currentPlayer.getName(),
          type: this.getActionType(diceAction),
          content: result.summary,
        });

        if (result.success) {
          currentState = result.newGameState;
          console.log(`✓ ${result.summary}`);
        } else {
          console.log(`✗ ${result.summary}`);
        }

        // Remove this die from remaining dice
        remainingDice = remainingDice.slice(1);
      } catch (error) {
        console.error(`Error during ${currentPlayer.getName()}'s dice action ${dieIndex + 1}:`, error);
        remainingDice = remainingDice.slice(1);
      }
    }

    // Update game state to final state after all actions
    this.gameState = currentState;

    // Step 4: Check for victory conditions
    const victoryCheck = checkVictory(this.gameState);
    if (victoryCheck.won) {
      this.endGame(victoryCheck.playerId, victoryCheck.condition);
      return;
    }

    // Check for max rounds limit
    if (this.gameState.currentRound >= this.maxRounds) {
      console.log(`\nGame ended: Maximum rounds (${this.maxRounds}) reached`);
      this.endGame();
      return;
    }

    // Step 5: Advance to next player
    this.gameState = this.gameState.advanceToNextPlayer();
  }

  /**
   * Execute an action and handle any runtime decisions that arise
   */
  private async executeAction(
    gameState: GameState,
    action: GameAction,
    playerId: number,
    diceValues: number[],
    currentPlayer: Player,
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case "moveChampion":
          return await this.executeMoveChampion(gameState, action, playerId, diceValues, currentPlayer);
        case "moveBoat":
          return await this.executeMoveBoat(gameState, action, playerId, diceValues, currentPlayer);
        case "harvest":
          return this.executeHarvestAction(gameState, action, playerId, diceValues);
        default:
          return {
            newGameState: gameState,
            summary: `Unknown action type: ${(action as any).type}`,
            success: false,
            diceValuesUsed: diceValues,
          };
      }
    } catch (error) {
      return {
        newGameState: gameState,
        summary: `Error executing action: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
        diceValuesUsed: diceValues,
      };
    }
  }

  private async executeMoveChampion(
    gameState: GameState,
    action: GameAction & { type: "moveChampion" },
    playerId: number,
    diceValues: number[],
    currentPlayer: Player,
  ): Promise<ActionResult> {
    // Execute the movement
    const moveResult = await executeChampionMove(gameState, action, playerId, diceValues);

    if (!moveResult.success) {
      return {
        newGameState: gameState,
        summary: moveResult.errorMessage!,
        success: false,
        diceValuesUsed: diceValues,
      };
    }

    let updatedGameState = moveResult.gameState;
    const actualDestination = moveResult.actualDestination;
    const champion = gameState.getChampionById(playerId, action.championId);

    // Handle tile arrival and interactions
    const arrivalResult = await this.tileArrivalHandler.handleChampionArrival(
      updatedGameState,
      playerId,
      action.championId,
      actualDestination,
      { claimTile: action.claimTile, gameDecks: this.gameDecks, currentPlayer },
    );

    if (!arrivalResult.success) {
      return {
        newGameState: gameState,
        summary: arrivalResult.summary,
        success: false,
        diceValuesUsed: diceValues,
      };
    }

    // Create appropriate summary message
    let summary = `Moved champion${action.championId} from (${champion!.position.row}, ${champion!.position.col}) to (${actualDestination.row}, ${actualDestination.col})`;

    // Check if movement was stopped by unexplored tile
    const originalDestination = action.path[action.path.length - 1];
    if (actualDestination.row !== originalDestination.row || actualDestination.col !== originalDestination.col) {
      summary += ` (stopped at unexplored tile instead of intended destination (${originalDestination.row}, ${originalDestination.col}))`;
    }

    summary += `. ${arrivalResult.summary}`;

    return {
      newGameState: arrivalResult.newGameState,
      summary,
      success: true,
      diceValuesUsed: diceValues,
    };
  }

  private async executeMoveBoat(
    gameState: GameState,
    action: GameAction & { type: "moveBoat" },
    playerId: number,
    diceValues: number[],
    currentPlayer: Player,
  ): Promise<ActionResult> {
    const moveResult = await executeBoatMove(gameState, action, playerId, diceValues);

    if (!moveResult.success) {
      return {
        newGameState: gameState,
        summary: moveResult.errorMessage!,
        success: false,
        diceValuesUsed: diceValues,
      };
    }

    let updatedGameState = moveResult.gameState;
    const destination = action.path[action.path.length - 1];
    let summary = `Moved boat${action.boatId} to ${destination}`;

    // Handle champion transport and tile interaction
    if (action.championId && action.championDropPosition) {
      const arrivalResult = await this.tileArrivalHandler.handleChampionArrival(
        updatedGameState,
        playerId,
        action.championId,
        action.championDropPosition,
        { gameDecks: this.gameDecks, currentPlayer },
      );

      if (!arrivalResult.success) {
        return {
          newGameState: gameState,
          summary: `${summary}, but champion transport failed: ${arrivalResult.summary}`,
          success: false,
          diceValuesUsed: diceValues,
        };
      }

      updatedGameState = arrivalResult.newGameState;
      summary += ` and transported champion${action.championId} to (${action.championDropPosition.row}, ${action.championDropPosition.col}). ${arrivalResult.summary}`;
    }

    return {
      newGameState: updatedGameState,
      summary,
      success: true,
      diceValuesUsed: diceValues,
    };
  }

  private executeHarvestAction(
    gameState: GameState,
    action: GameAction & { type: "harvest" },
    playerId: number,
    diceValues: number[],
  ): ActionResult {
    const harvestResult = executeHarvest(gameState, action, playerId, diceValues);

    return {
      newGameState: harvestResult.gameState,
      summary: harvestResult.summary,
      success: harvestResult.success,
      diceValuesUsed: diceValues,
    };
  }

  /**
   * Handle a runtime decision by asking the current player
   */
  public async handleRuntimeDecision(player: Player, decisionContext: DecisionContext): Promise<any> {
    try {
      const decision = await player.makeDecision(this.gameState, this.gameLog, decisionContext);

      // Log the decision
      this.addLogEntry({
        round: this.gameState.currentRound,
        playerId: this.gameState.getCurrentPlayer().id,
        playerName: player.getName(),
        type: "event",
        content: `Decision: ${decisionContext.description} -> ${JSON.stringify(decision.choice)}`,
        metadata: { reasoning: decision.reasoning },
      });

      return decision.choice;
    } catch (error) {
      console.error(`Error getting decision from ${player.getName()}:`, error);

      // Fallback to first available option
      if (decisionContext.options.length > 0) {
        return decisionContext.options[0];
      }
      return null;
    }
  }

  /**
   * Run the complete game session until finished
   */
  public async runToCompletion(): Promise<void> {
    this.start();

    while (this.masterState === "playing") {
      await this.executeTurn();
    }

    console.log("\n=== Game Session Complete ===");
    this.printGameSummary();
  }

  /**
   * Get the current game state
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Get the master state
   */
  public getMasterState(): GameMasterState {
    return this.masterState;
  }

  /**
   * Get the game log
   */
  public getGameLog(): readonly GameLogEntry[] {
    return [...this.gameLog];
  }

  /**
   * Update the game state (useful for UI changes like extra instructions)
   */
  public updateGameState(newGameState: GameState): void {
    this.gameState = newGameState;
  }

  /**
   * Add an entry to the game log
   */
  private addLogEntry(entry: GameLogEntry): void {
    this.gameLog.push(entry);
  }

  /**
   * Convert GameAction to readable string
   */
  private actionToString(action: GameAction): string {
    switch (action.type) {
      case "moveChampion":
        const pathStr = action.path.map((p) => `(${p.row},${p.col})`).join(" -> ");
        let moveStr = `Move champion ${action.championId} along path: ${pathStr}`;
        if (action.claimTile) {
          moveStr += " and claim tile";
        }
        return moveStr;

      case "moveBoat":
        const boatPathStr = action.path.join(" -> ");
        let str = `Move boat ${action.boatId} to: ${boatPathStr}`;
        if (action.championId && action.championDropPosition) {
          str += ` (transporting champion ${action.championId} to (${action.championDropPosition.row},${action.championDropPosition.col}))`;
        }
        return str;

      case "harvest":
        const resources = Object.entries(action.resources)
          .filter(([_, amount]) => amount > 0)
          .map(([type, amount]) => `${amount} ${type}`)
          .join(", ");
        return `Harvest: ${resources || "nothing"}`;

      default:
        return `Unknown action: ${(action as any).type}`;
    }
  }

  /**
   * Determine log entry type based on action
   */
  private getActionType(action: GameAction): "movement" | "combat" | "harvest" | "assessment" | "event" | "system" {
    switch (action.type) {
      case "moveChampion":
      case "moveBoat":
        return "movement";
      case "harvest":
        return "harvest";
      default:
        return "system";
    }
  }

  private endGame(winnerId?: number, condition?: string): void {
    this.masterState = "finished";

    if (winnerId) {
      const winner = this.players.find((p) => this.gameState.getPlayerById(winnerId)?.id === winnerId);
      console.log(`\n🎉 GAME WON! 🎉`);
      console.log(`Winner: ${winner?.getName() || `Player ${winnerId}`}`);
      if (condition) {
        console.log(`Victory Condition: ${condition}`);
      }

      this.addLogEntry({
        round: this.gameState.currentRound,
        playerId: winnerId,
        playerName: winner?.getName() || `Player ${winnerId}`,
        type: "system",
        content: `VICTORY! ${condition || "Game won"}`,
      });
    } else {
      console.log(`\nGame ended without a winner`);
      this.addLogEntry({
        round: this.gameState.currentRound,
        playerId: -1,
        playerName: "System",
        type: "system",
        content: "Game ended without a winner",
      });
    }

    this.gameState = this.gameState.withUpdates({
      gameEnded: true,
      winner: winnerId,
    });
  }

  private printGameSummary(): void {
    console.log(`\nGame completed after ${this.gameState.currentRound} rounds`);
    console.log(`Total log entries: ${this.gameLog.length}`);

    // Print final player states
    console.log("\nFinal Player States:");
    for (const player of this.gameState.players) {
      console.log(`${player.name}: Fame=${player.fame}, Resources=${JSON.stringify(player.resources)}`);
    }

    // Print log entry statistics
    const logTypes = this.gameLog.reduce(
      (acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(`\nLog Entry Statistics:`);
    Object.entries(logTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
  }
}
