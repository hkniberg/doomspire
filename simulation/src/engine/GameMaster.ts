// Lords of Doomspire Game Master
//
// Each round has 4 phases (per the game rules):
// 1. Fate Phase (together): move the first player token, draw and resolve the round's fate card
// 2. Roll Phase (parallel): all players roll their action dice
// 3. Move Phase (sequential): one player at a time, use dice for movement and tile actions
// 4. Harvest Phase (parallel): use remaining dice to harvest, use buildings, perform one build action
//
// executeTurn() executes one player's move phase. The fate + roll phases run automatically before the
// first player's move phase of the round, and the harvest phase runs after the last player's move phase.

import { BoatAction, ChampionAction, HarvestDecision, TileAction } from "@/lib/actionTypes";
import { GameLogEntry, GameLogEntryType, GamePhase, Player, Position, Tile, TurnContext } from "@/lib/types";
import { formatPosition, formatResources } from "@/lib/utils";
import { FATE_CARDS, FIRST_FATE_CARD_ID, FateCard } from "@/content/fateCards";
import { GameState } from "../game/GameState";
import { stringifyTileForGameLog } from "../game/gameStateStringifier";
import { CARDS, GameDecks } from "../lib/cards";
import { PlayerAgent } from "../players/PlayerAgent";
import { calculateHarvest, getEligibleHarvestTiles } from "./actions/harvestCalculator";
import { calculateBoatMove, calculateChampionMove } from "./actions/moveCalculator";
import { DiceRoller, RandomDiceRoller } from "./DiceRoller";
import { DiceRolls } from "./DiceRolls";
import { handleAdventureCard } from "./handlers/adventureCardHandler";
import { handleBuildingUsage as handleBuildingUsageHandler, hasHarvestPhaseBuildingOptions } from "./handlers/buildingUsageHandler";
import { resolveFateCard } from "./handlers/fateCardHandler";
import {
  handleChampionCombat,
  handleDoomspireTile,
  handleExploration,
  handleItemManagement,
  handleMercenaryAction,
  handleMonsterCombat,
  handleSpecialTiles,
  handleTempleAction,
  handleTileClaiming,
  handleTileInteractions
} from "./handlers/tileArrivalHandler";
import { createTraderContext, handleTraderInteraction } from "./handlers/traderHandler";
import { StatisticsCollector } from "./StatisticsCollector";
import { GameSettings } from "@/lib/GameSettings";
import { NON_COMBAT_TILES } from "@/lib/types";

export type GameMasterState = "setup" | "playing" | "finished";

export interface GameMasterConfig {
  players: PlayerAgent[];
  maxRounds?: number; // Optional limit for testing
  startingValues?: { fame?: number; might?: number; food?: number; wood?: number; ore?: number; gold?: number }; // Optional starting values
  seed?: number; // Optional seed for board generation
}

export class GameMaster {
  private diceRoller: DiceRoller;
  private gameState: GameState;
  private playerAgents: PlayerAgent[];
  private masterState: GameMasterState;
  private maxRounds: number;
  private gameLog: GameLogEntry[];
  private gameDecks: GameDecks;
  private statisticsCollector: StatisticsCollector;

  // Round state
  private roundInitialized: boolean = false;
  private playerDice: Map<string, DiceRolls> = new Map();
  private savedHarvestDice: Map<string, number[]> = new Map(); // Dice values saved during the move phase for harvesting
  private fateDeck: FateCard[] = [];
  private currentPhase: GamePhase = "fate";
  private currentFateCard: FateCard | null = null;

  constructor(config: GameMasterConfig) {
    // Create GameState with the correct player names from the start
    this.diceRoller = new RandomDiceRoller();
    const playerNames = config.players.map((player) => player.getName());
    this.gameState = GameState.createWithPlayerNames(playerNames, config.startingValues, config.seed);
    this.playerAgents = config.players;
    this.masterState = "setup";
    this.maxRounds = config.maxRounds || 100; // Default limit to prevent infinite games
    this.gameLog = [];
    this.gameDecks = new GameDecks(CARDS);
    this.statisticsCollector = new StatisticsCollector();
    this.initializeFateDeck();
  }

  /**
   * Shuffle the fate deck and place Settling face up on top (drawn first).
   */
  private initializeFateDeck(): void {
    const settling = FATE_CARDS.find((card) => card.id === FIRST_FATE_CARD_ID);
    const rest = FATE_CARDS.filter((card) => card.id !== FIRST_FATE_CARD_ID);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    // Cards are drawn from the end of the array
    this.fateDeck = [...rest.reverse()];
    if (settling) {
      this.fateDeck.push(settling);
    }
  }

  private drawFateCard(): FateCard {
    if (this.fateDeck.length === 0) {
      // Reshuffle all fate cards except Settling (which is only ever the first card of the game)
      const rest = FATE_CARDS.filter((card) => card.id !== FIRST_FATE_CARD_ID);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      this.fateDeck = rest;
    }
    return this.fateDeck.pop()!;
  }

  /**
   * Start the game session
   */
  public start(): void {
    if (this.masterState !== "setup") {
      throw new Error(`Cannot start game: session is in state ${this.masterState}`);
    }

    console.log("=== Lords of Doomspire Game Session Starting ===");
    console.log(`Players: ${this.playerAgents.map((p) => p.getName()).join(", ")}`);
    console.log("================================================");

    this.masterState = "playing";
  }

  /**
   * Execute the next player's move phase (running the fate/roll phases at round start,
   * and the harvest phase after the last player's move phase).
   */
  public async executeTurn(onStepUpdate?: () => void): Promise<void> {
    if (this.masterState !== "playing") {
      throw new Error(`Cannot execute turn: session is in state ${this.masterState}`);
    }

    // Phase 1 + 2: fate and roll phases at the start of each round
    if (!this.roundInitialized) {
      await this.startRound(onStepUpdate);
      if (this.masterState !== "playing") {
        return;
      }
    }

    // Phase 3: move phase for the current player
    await this.executeMovePhaseForCurrentPlayer(onStepUpdate);
    if (this.masterState !== "playing") {
      return;
    }

    // Advance to the next player, or run the harvest phase if everyone has moved
    const nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
    if (nextPlayerIndex === this.gameState.startPlayerIndex) {
      // Phase 4: harvest phase for all players
      await this.executeHarvestPhase(onStepUpdate);
      if (this.masterState !== "playing") {
        return;
      }
      this.endRound();
    } else {
      this.gameState.currentPlayerIndex = nextPlayerIndex;
    }
  }

  /**
   * Phase 1 (Fate) + Phase 2 (Roll) for the whole table.
   */
  private async startRound(onStepUpdate?: () => void): Promise<void> {
    // === Fate phase ===
    this.currentPhase = "fate";

    // Move the first player token clockwise (rounds 2+; the initial starting player is decided at setup)
    if (this.gameState.currentRound > 1) {
      this.gameState.startPlayerIndex = (this.gameState.startPlayerIndex + 1) % this.gameState.players.length;
      this.addGameLogEntry("system", `Starting player token passes to ${this.gameState.getStartingPlayer().name} for Round ${this.gameState.currentRound}`);
    }
    this.gameState.currentPlayerIndex = this.gameState.startPlayerIndex;

    // Reset per-round state (fate effects, interaction locks, special tile usage, impression limits)
    this.gameState.resetRoundState();

    // Capture the food tax multiplier for this round (Blessing of the Lonesome doubles it for one round)
    const foodTaxMultiplier = this.gameState.doubleFoodTaxNextRound ? 2 : 1;
    this.gameState.doubleFoodTaxNextRound = false;

    const fateCard = this.drawFateCard();
    this.currentFateCard = fateCard;
    this.addGameLogEntry("fate", `Fate card drawn: ${fateCard.name} - ${fateCard.effect.replace(/\*/g, "")}`);

    try {
      const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);
      const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);
      await resolveFateCard(fateCard, this.gameState, this.playerAgents, this.gameLog, logFn, thinkingLogger);
    } catch (error) {
      console.error("Error resolving fate card:", error);
      this.addGameLogEntry("error", `Fate card resolution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (onStepUpdate) {
      onStepUpdate();
    }

    // === Roll phase (all players roll simultaneously) ===
    this.currentPhase = "roll";
    this.playerDice.clear();
    this.savedHarvestDice.clear();

    const taxPerDie = GameSettings.DICE_TAX_FOOD_PER_DIE * foodTaxMultiplier;
    if (foodTaxMultiplier > 1) {
      this.addGameLogEntry("system", `Food tax is doubled this round (${taxPerDie} food per extra die)`);
    }

    for (const player of this.gameState.players) {
      let totalDiceCount = 1 + player.champions.length;

      // Penalty fate card: target rolls one fewer die (minimum 1)
      if (this.gameState.fateEffects.dicePenaltyPlayer === player.name) {
        totalDiceCount = Math.max(1, totalDiceCount - 1);
      }

      // Dice tax: each die after the first two costs food. If you can't pay, you don't get those dice.
      const freeDice = GameSettings.FREE_DICE_COUNT;
      const taxedDice = Math.max(0, totalDiceCount - freeDice);
      const foodCost = taxedDice * taxPerDie;

      const affordableDice = player.resources.food >= foodCost
        ? totalDiceCount
        : freeDice + Math.floor(player.resources.food / taxPerDie);
      const actualDiceCount = Math.min(totalDiceCount, Math.max(1, affordableDice));
      const actualFoodCost = Math.max(0, actualDiceCount - freeDice) * taxPerDie;

      player.resources.food -= actualFoodCost;

      if (actualDiceCount < totalDiceCount) {
        this.addGameLogEntry("dice", `${player.name} lost ${totalDiceCount - actualDiceCount} dice due to insufficient food (dice tax: ${taxPerDie} food per extra die).`);
      }

      const diceRollValues = this.diceRoller.rollMultipleD3(actualDiceCount);
      this.playerDice.set(player.name, new DiceRolls(diceRollValues));
      this.addGameLogEntry("dice", `${player.name} rolled ${actualDiceCount} dice: ${diceRollValues.map(die => `[${die}]`).join(", ")}${actualFoodCost > 0 ? ` (paid ${actualFoodCost} food dice tax)` : ""}`);
    }

    if (onStepUpdate) {
      onStepUpdate();
    }

    this.roundInitialized = true;
  }

  /**
   * Phase 3: one player's move phase. Champion/boat dice actions are executed immediately.
   * Harvest dice actions are recorded and executed later during the harvest phase.
   */
  private async executeMovePhaseForCurrentPlayer(onStepUpdate?: () => void): Promise<void> {
    this.currentPhase = "move";
    const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.getCurrentPlayer();
    const diceRolls = this.playerDice.get(currentPlayer.name);
    if (!diceRolls) {
      throw new Error(`No dice found for player ${currentPlayer.name}`);
    }

    console.log(`\n--- ${currentPlayerAgent.getName()}'s Move Phase (Round ${this.gameState.currentRound}) ---`);

    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);

    // A knight staying at Doomspire must impress the dragon each round or be eaten
    await this.handleDoomspireStayCheck(currentPlayer, currentPlayerAgent, thinkingLogger);
    if (this.masterState !== "playing") {
      return;
    }

    // Strategic assessment (with dice context)
    try {
      if (currentPlayerAgent.makeStrategicAssessment) {
        const strategicAssessment = await currentPlayerAgent.makeStrategicAssessment(
          this.gameState,
          this.gameLog,
          diceRolls.getRemainingRolls(),
          this.gameState.currentRound,
          this.gameDecks.getAvailableTraderCards(),
          thinkingLogger
        );
        if (strategicAssessment) {
          this.addGameLogEntry("assessment", strategicAssessment);
        }
      }
    } catch (error) {
      console.error("Error during strategic assessment:", error);
      this.addGameLogEntry("error", `Strategic assessment failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (onStepUpdate) {
      onStepUpdate();
    }

    // Execute dice actions until the player runs out of dice
    while (diceRolls.hasRemainingRolls()) {
      const turnContext: TurnContext = {
        turnNumber: this.gameState.currentRound,
        diceRolled: diceRolls.getRemainingRolls(),
        remainingDiceValues: diceRolls.getRemainingRolls(),
      };

      try {
        const diceAction = await currentPlayerAgent.decideDiceAction(this.gameState, this.gameLog, turnContext, thinkingLogger);

        const actionType = diceAction.actionType;
        if (actionType == "championAction") {
          const championAction = diceAction.championAction!;
          const diceValues = championAction.diceValuesUsed && championAction.diceValuesUsed.length > 0
            ? championAction.diceValuesUsed
            : [championAction.diceValueUsed];
          diceRolls.consumeMultipleDiceRolls(diceValues);
          await this.executeChampionAction(currentPlayer, championAction, diceValues, diceAction.reasoning);
          if (currentPlayer.statistics) {
            currentPlayer.statistics.championActions += 1;
          }
        } else if (actionType === "boatAction") {
          const boatAction = diceAction.boatAction!;
          diceRolls.consumeDiceRoll(boatAction.diceValueUsed);
          await this.executeBoatAction(currentPlayer, boatAction, diceAction.reasoning);
          if (currentPlayer.statistics) {
            currentPlayer.statistics.boatActions += 1;
          }
        } else if (actionType === "harvestAction") {
          // The dice are saved now; which tiles to harvest is decided during the harvest phase
          const harvestAction = diceAction.harvestAction!;
          diceRolls.consumeMultipleDiceRolls(harvestAction.diceValuesUsed);
          const savedDice = this.savedHarvestDice.get(currentPlayer.name) || [];
          savedDice.push(...harvestAction.diceValuesUsed);
          this.savedHarvestDice.set(currentPlayer.name, savedDice);
          const diceString = harvestAction.diceValuesUsed.map(die => `[${die}]`).join("+");
          this.addGameLogEntry("harvest", `Saved dice ${diceString} for the harvest phase.${diceAction.reasoning ? ` Reason: ${diceAction.reasoning}.` : ""}`);
        } else {
          throw new Error(`Unknown action type: ${actionType}`);
        }
      } catch (error) {
        console.error("Error during dice action execution:", error);
        this.addGameLogEntry("error", `Dice action failed: ${error instanceof Error ? error.message : String(error)}`);

        // Consume a die to prevent infinite loops, but don't execute any action
        const remainingRolls = diceRolls.getRemainingRolls();
        if (remainingRolls.length > 0) {
          diceRolls.consumeDiceRoll(remainingRolls[0]);
          this.addGameLogEntry("dice", `Consumed die [${remainingRolls[0]}] due to action failure`);
        }
      }

      if (onStepUpdate) {
        onStepUpdate();
      }

      // The game may have ended during the action (dragon impressions)
      if (this.masterState !== "playing") {
        return;
      }
    }
  }

  /**
   * A knight staying at Doomspire must impress the dragon each round or be eaten.
   * Checked at the start of the player's move phase.
   */
  private async handleDoomspireStayCheck(
    player: Player,
    playerAgent: PlayerAgent,
    thinkingLogger?: (content: string) => void
  ): Promise<void> {
    const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);
    const getPlayerAgent = (playerName: string) => {
      const playerIndex = this.gameState.players.findIndex(p => p.name === playerName);
      return playerIndex >= 0 ? this.playerAgents[playerIndex] : undefined;
    };

    // Copy the champion list since a champion may be eaten (removed) during iteration
    const champions = [...player.champions];
    for (const champion of champions) {
      const tile = this.gameState.getTile(champion.position);
      if (!tile || tile.tileType !== "doomspire" || !tile.explored) {
        continue;
      }

      logFn("event", `Champion${champion.id} is staying at Doomspire and must impress the dragon again or be eaten!`);
      const doomspireResult = await handleDoomspireTile(
        this.gameState, tile, player, champion.id, logFn,
        playerAgent, this.gameLog, thinkingLogger, getPlayerAgent
      );

      if (doomspireResult.gameWon) {
        this.endGameWithRanking(player.name);
        return;
      }
    }
  }

  /**
   * Phase 4: harvest phase, done simultaneously by all players (as described in the rules).
   * Each player decides which tiles to harvest from (using dice saved during the move phase),
   * which buildings to use, and which build action to perform - all in one decision.
   *
   * All players resolve in parallel, so e.g. an AI player can compute its harvest decision
   * while a human player is clicking in the harvest modal. To keep the log readable, each
   * player's log entries are buffered and emitted as one block when that player finishes.
   */
  private async executeHarvestPhase(onStepUpdate?: () => void): Promise<void> {
    this.currentPhase = "harvest";
    this.gameState.currentPlayerIndex = this.gameState.startPlayerIndex;

    const runPlayerHarvestPhase = async (playerIndex: number): Promise<GameLogEntry[]> => {
      const player = this.gameState.players[playerIndex];
      const playerAgent = this.playerAgents[playerIndex];

      const logBuffer: GameLogEntry[] = [];
      const logFn = (type: string, content: string) => {
        logBuffer.push({
          round: this.gameState.currentRound,
          phase: "harvest",
          playerName: player.name,
          type: type as GameLogEntryType,
          content: content,
        });
      };
      const thinkingLogger = (content: string) => logFn("thinking", content);

      const savedDice = this.savedHarvestDice.get(player.name) || [];

      // Ask the player for their harvest phase decision (skip if there is nothing to decide)
      let decision: HarvestDecision = {};
      if (savedDice.length > 0 || hasHarvestPhaseBuildingOptions(player)) {
        try {
          decision = await playerAgent.makeHarvestDecision(this.gameState, this.gameLog, player.name, savedDice, thinkingLogger);
        } catch (error) {
          console.error("Error during harvest decision:", error);
          logFn("error", `Harvest decision failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Execute the harvest with the chosen tiles
      if (savedDice.length > 0) {
        try {
          this.executeHarvest(player, savedDice, decision.harvestTiles || [], logFn);
          if (player.statistics) {
            player.statistics.harvestActions += 1;
          }
        } catch (error) {
          console.error("Error during harvest execution:", error);
          logFn("error", `Harvest failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Use buildings, then perform one build action
      try {
        handleBuildingUsageHandler(player, decision, this.gameState, logFn);
      } catch (error) {
        console.error("Error during building usage:", error);
        logFn("error", `Building usage failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      return logBuffer;
    };

    const finishPlayerHarvestPhase = async (playerIndex: number): Promise<void> => {
      const logBuffer = await runPlayerHarvestPhase(playerIndex);
      // Emit this player's log entries as one block, in completion order across players
      for (const entry of logBuffer) {
        console.log(`${entry.playerName} ${entry.type}: ${entry.content}`);
        this.gameLog.push(entry);
      }
      if (onStepUpdate) {
        onStepUpdate();
      }
    };

    // Human players share a single decision modal in the UI, so they take turns (in seat order).
    // Everyone else runs fully in parallel with them.
    const playerIndices = this.gameState.players.map((_, index) => index);
    const humanIndices = playerIndices.filter(index => this.playerAgents[index].getType() === "human");
    const nonHumanIndices = playerIndices.filter(index => this.playerAgents[index].getType() !== "human");

    await Promise.all([
      ...nonHumanIndices.map(finishPlayerHarvestPhase),
      (async () => {
        for (const humanIndex of humanIndices) {
          await finishPlayerHarvestPhase(humanIndex);
        }
      })(),
    ]);

    this.savedHarvestDice.clear();
  }

  /**
   * End of round: capture statistics, check the round limit, and advance the round counter.
   */
  private endRound(): void {
    this.statisticsCollector.captureTurnStatistics(this.gameState);

    if (this.gameState.currentRound >= this.maxRounds) {
      console.log(`\nGame ended: Maximum rounds (${this.maxRounds}) reached`);
      this.endGame();
      return;
    }

    this.gameState.currentRound += 1;
    this.roundInitialized = false;
  }

  private getPlayerAgentByName = (playerName: string): PlayerAgent | undefined => {
    const playerIndex = this.gameState.players.findIndex(p => p.name === playerName);
    return playerIndex >= 0 ? this.playerAgents[playerIndex] : undefined;
  };

  private async executeChampionAction(
    player: Player,
    action: ChampionAction,
    diceValues: number[],
    reasoning?: string,
  ): Promise<void> {

    // Get the champion's current position before moving
    const champion = this.gameState.getChampion(player.name, action.championId);
    if (!champion) {
      throw new Error(`Champion ${action.championId} not found for player ${player.name}`);
    }

    // Once a knight has interacted with a tile, it cannot use any more action dice this round
    if (champion.hasInteractedThisRound) {
      throw new Error(`Champion ${action.championId} has already interacted with a tile and cannot use more action dice this round`);
    }

    const isMoving = !!(action.movementPathIncludingStartPosition && action.movementPathIncludingStartPosition.length > 1);

    // Lockdown fate card: the target cannot move any knights this round
    if (isMoving && this.gameState.fateEffects.lockdownPlayer === player.name) {
      throw new Error(`${player.name} is under Lockdown and cannot move knights this round`);
    }

    const startPosition = champion.position;
    const totalDiceValue = diceValues.reduce((sum, v) => sum + v, 0);
    const diceString = diceValues.map(die => `[${die}]`).join("+");

    // Handle movement if a path is provided
    let endPosition = startPosition;
    if (isMoving) {
      // Execute the movement calculation (sprinting: multiple dice values add up)
      const moveResult = calculateChampionMove(this.gameState, player.name, action.movementPathIncludingStartPosition!, totalDiceValue);

      // Pass-through blocking: an opposing player may force a passing knight to stop and fight
      const blockedPosition = await this.checkPassThroughBlocking(
        player, action.movementPathIncludingStartPosition!, moveResult.endPosition
      );
      const finalPosition = blockedPosition || moveResult.endPosition;

      // Update champion position
      const tile = this.gameState.updateChampionPosition(player.name, action.championId, finalPosition);

      // Check if champion actually moved to a different position
      const actuallyMoved = startPosition.row !== finalPosition.row || startPosition.col !== finalPosition.col;

      // Create log message with reasoning first, then detailed tile description
      // For movement, we need to account for exploration that will happen
      const wasUnexplored = !tile.explored;
      let tileDescription: string;

      if (actuallyMoved && wasUnexplored) {
        // Temporarily mark as explored to get the proper description
        tile.explored = true;
        tileDescription = `This was unexplored, but I explored it. ${stringifyTileForGameLog(tile, this.gameState, player.name)}`;
        // Restore the unexplored state (it will be properly explored later)
        tile.explored = false;
      } else {
        tileDescription = stringifyTileForGameLog(tile, this.gameState, player.name);
      }

      const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";
      const blockedText = blockedPosition ? " (movement was blocked by an opposing knight!)" : "";

      if (actuallyMoved) {
        this.addGameLogEntry("movement", `Champion${action.championId} moved from ${formatPosition(startPosition)} to ${formatPosition(finalPosition)}, using dice ${diceString}${blockedText}. ${tileDescription}${reasoningText}`);
      } else {
        this.addGameLogEntry("movement", `Champion${action.championId} stayed in ${formatPosition(startPosition)}, using dice ${diceString}. ${tileDescription}${reasoningText}`);
      }
      endPosition = finalPosition;
    } else {
      // Champion is staying in place, just log the action
      const tile = this.gameState.getTile(startPosition);
      const tileDescription = tile ? stringifyTileForGameLog(tile, this.gameState, player.name) : "This is an unknown tile.";
      const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";
      this.addGameLogEntry("movement", `Champion${action.championId} stayed in ${formatPosition(startPosition)}, using dice ${diceString}.${reasoningText} ${tileDescription}`);
    }

    // Get the tile at the final position for arrival handling
    const tile = this.gameState.getTile(endPosition);
    if (!tile) {
      throw new Error(`No tile found at position ${formatPosition(endPosition)}`);
    }

    await this.executeChampionArrivalAtTile(player, tile, action.championId, action.tileAction);
  }

  /**
   * When a knight passes through a tile with an opposing knight, the opposing player may
   * force them to stop and fight. Returns the blocking position, or null if not blocked.
   */
  private async checkPassThroughBlocking(
    player: Player,
    path: Position[],
    endPosition: Position
  ): Promise<Position | null> {
    // No blocking during Ceasefire (knights pass through freely) or Settling (can't enter such tiles at all)
    if (this.gameState.fateEffects.noPvpCombat || this.gameState.fateEffects.settling) {
      return null;
    }

    // Find the index of the end position in the path
    const endIndex = path.findIndex(p => p.row === endPosition.row && p.col === endPosition.col);
    if (endIndex <= 1) {
      return null; // No intermediate tiles
    }

    // Check intermediate tiles (not the start, not the end)
    for (let i = 1; i < endIndex; i++) {
      const position = path[i];
      const tile = this.gameState.getTile(position);
      if (!tile || (tile.tileType && NON_COMBAT_TILES.includes(tile.tileType))) {
        continue;
      }

      const opposingChampions = this.gameState.getOpposingChampionsAtPosition(player.name, position);
      if (opposingChampions.length === 0) {
        continue;
      }

      const opposingPlayerName = opposingChampions[0].playerName;
      const opposingAgent = this.getPlayerAgentByName(opposingPlayerName);
      if (!opposingAgent) {
        continue;
      }

      try {
        const decision = await opposingAgent.makeDecision(this.gameState, this.gameLog, {
          description: `${opposingPlayerName}: ${player.name}'s knight is trying to pass through your knight's tile at (${position.row}, ${position.col}). You may force them to stop and fight.`,
          options: [
            { id: "allow", description: "Let them pass" },
            { id: "block", description: "Force them to stop and fight" }
          ]
        });

        if (decision.choice === "block") {
          this.addGameLogEntry("combat", `${opposingPlayerName} blocks ${player.name}'s knight at (${position.row}, ${position.col}) and forces a fight!`);
          return position;
        }
      } catch (error) {
        // If the opposing agent fails, they allow passage
      }
    }

    return null;
  }

  private async executeBoatAction(player: Player, action: BoatAction, reasoning?: string): Promise<void> {
    const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";

    // Fog of War fate card: no boat movement or transport this round
    if (this.gameState.fateEffects.noBoatMovement) {
      this.addGameLogEntry("boat", `Boat ${action.boatId} cannot move: Fog of War prevents all boat movement this round. Die is wasted.`);
      return;
    }

    const championId = action.championIdToPickUp;
    const champion = championId ? this.gameState.getChampion(player.name, championId) : undefined;
    const championStartPosition = champion ? champion.position : undefined;

    // Storm Season fate card: boats can move, but cannot transport knights
    const transportBlocked = this.gameState.fateEffects.noBoatTransport === true;

    // Favorable Winds fate card: +1 step on boat movements
    const effectiveDiceValue = action.diceValueUsed + (this.gameState.fateEffects.boatMovementBonus || 0);

    // Handle boat movement if a path is provided
    if (action.movementPathIncludingStartPosition && action.movementPathIncludingStartPosition.length > 0) {
      const boatMoveResult = calculateBoatMove(
        action.movementPathIncludingStartPosition,
        effectiveDiceValue,
        transportBlocked ? undefined : championStartPosition,
        transportBlocked ? undefined : action.championDropPosition
      );

      // Get boat start position for logging
      const boatStartPosition = action.movementPathIncludingStartPosition[0];

      // Update the boat's actual position in the game state
      const boat = player.boats.find(b => b.id === action.boatId);
      if (!boat) {
        throw new Error(`Boat ${action.boatId} not found for player ${player.name}`);
      }
      boat.position = boatMoveResult.endPosition;

      if (transportBlocked && championId !== undefined) {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition}, but could not transport champion ${championId}: no boat transport this round.${reasoningText}`);
        return;
      }

      if (boatMoveResult.championMoveResult === "championMoved" && championId !== undefined && action.championDropPosition) {
        await this.transportChampionByBoat(player, action, championId, championStartPosition!, boatStartPosition, boatMoveResult.endPosition, reasoningText);
      } else if (boatMoveResult.championMoveResult === "championNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to move champion ${championId} at ${formatPosition(championStartPosition!)} but the champion was not reachable by this boat, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else if (boatMoveResult.championMoveResult === "targetPositionNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to drop champion ${championId} at ${formatPosition(action.championDropPosition!)} but that position is not a coastal tile in the target ocean zone, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else {
        // Handle case where boat moves but no champion transport was requested or possible
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition}, using dice value [${action.diceValueUsed}].${reasoningText}`);
      }
    } else {
      // Boat is staying in place but still using a die
      this.addGameLogEntry("boat", `Boat ${action.boatId} stayed in position, using dice value [${action.diceValueUsed}].${reasoningText}`);

      // If there's a champion to pick up and drop off without moving the boat
      if (championId && action.championDropPosition && !transportBlocked) {
        const boat = player.boats.find(b => b.id === action.boatId);
        if (boat) {
          await this.transportChampionByBoat(player, action, championId, championStartPosition!, boat.position, boat.position, reasoningText);
        }
      } else if (championId && transportBlocked) {
        this.addGameLogEntry("boat", `Could not transport champion ${championId}: no boat transport this round.`);
      }
    }
  }

  /**
   * Move a transported champion to the drop position and handle tile arrival.
   * A knight that has already interacted with a tile this round can still be transported,
   * but cannot interact with the target tile and cannot be dropped on a tile that requires interaction.
   */
  private async transportChampionByBoat(
    player: Player,
    action: BoatAction,
    championId: number,
    championStartPosition: Position,
    boatStartPosition: string,
    boatEndPosition: string,
    reasoningText: string
  ): Promise<void> {
    const champion = this.gameState.getChampion(player.name, championId);
    if (!champion) {
      throw new Error(`Champion ${championId} not found for player ${player.name}`);
    }

    const dropPosition = action.championDropPosition!;
    const targetTile = this.gameState.getTile(dropPosition);
    if (!targetTile) {
      throw new Error(`No tile found at position ${formatPosition(dropPosition)}`);
    }

    // A knight that has already interacted cannot be dropped on a tile that requires interaction
    if (champion.hasInteractedThisRound) {
      const requiresInteraction =
        !targetTile.explored ||
        targetTile.monster !== undefined ||
        targetTile.tileType === "doomspire" ||
        ((targetTile.tileType === "adventure" || targetTile.tileType === "oasis") && (targetTile.adventureTokens || 0) > 0) ||
        (this.gameState.getOpposingChampionsAtPosition(player.name, dropPosition).length > 0 &&
          !(targetTile.tileType && NON_COMBAT_TILES.includes(targetTile.tileType)));

      if (requiresInteraction) {
        this.addGameLogEntry("boat", `Boat ${action.boatId} could not drop champion ${championId} at ${formatPosition(dropPosition)}: the champion has already interacted this round and cannot be dropped on a tile that requires interaction.${reasoningText}`);
        return;
      }

      // Transport without interaction
      this.gameState.updateChampionPosition(player.name, championId, dropPosition);
      this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatEndPosition}, transporting champion ${championId} from ${formatPosition(championStartPosition)} to ${formatPosition(dropPosition)} (no interaction - champion already interacted this round).${reasoningText}`);
      return;
    }

    // Settling fate card: knights cannot move into a tile with another knight or a creature
    if (this.gameState.fateEffects.settling) {
      const hasOpposingChampion = this.gameState.getOpposingChampionsAtPosition(player.name, dropPosition).length > 0;
      if (hasOpposingChampion || targetTile.monster !== undefined) {
        this.addGameLogEntry("boat", `Boat ${action.boatId} could not drop champion ${championId} at ${formatPosition(dropPosition)}: Settling prevents moving into a tile with another knight or a creature.${reasoningText}`);
        return;
      }
    }

    const tile = this.gameState.updateChampionPosition(player.name, championId, dropPosition);
    const tileDescription = stringifyTileForGameLog(tile, this.gameState, player.name);
    this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatEndPosition}, transporting champion ${championId} from ${formatPosition(championStartPosition)} to ${formatPosition(dropPosition)}. Champion arrived: ${tileDescription}.${reasoningText}`);
    await this.executeChampionArrivalAtTile(player, tile, championId, action.championTileAction);
  }

  /**
   * Handle a champion's arrival at a tile.
   *
   * Automatic interactions, in rules order: Explore, Combat, Impress the dragon (Doomspire), Adventure.
   * Then voluntary interactions: special locations, claiming, conquest/bribery, item management.
   *
   * Item pickup/drop does not count as a tile interaction.
   */
  private async executeChampionArrivalAtTile(player: Player, tile: Tile, championId: number, tileAction: TileAction | undefined): Promise<void> {
    // Create logging wrappers that match the handler's expected signature
    const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);
    const getPlayerAgent = this.getPlayerAgentByName;

    const champion = this.gameState.getChampion(player.name, championId);
    const markInteracted = () => {
      if (champion) {
        champion.hasInteractedThisRound = true;
      }
    };

    // Step 1: Handle exploration (automatic)
    const wasUnexplored = !tile.explored;
    handleExploration(this.gameState, tile, player, logFn);
    if (wasUnexplored) {
      markInteracted();
    }

    // Step 2: Handle ALL existing combat (automatic, takes priority over adventure cards)
    let existingCombatOccurred = false;

    // Step 2a: Handle champion combat
    const championCombatResult = await handleChampionCombat(
      this.gameState,
      tile,
      player,
      championId,
      this.playerAgents[this.gameState.currentPlayerIndex],
      this.gameLog,
      logFn,
      thinkingLogger,
      getPlayerAgent
    );
    if (championCombatResult.combatOccurred) {
      existingCombatOccurred = true;
      markInteracted();
      if (!championCombatResult.attackerWon) {
        // Attacker lost, defeat effects already applied by combat handler
        return;
      }

      // After winning PVP at Doomspire, the winner may choose a free ride home instead of facing the dragon
      if (tile.tileType === "doomspire") {
        const rideHome = await this.offerDragonRideHome(player, championId, logFn, thinkingLogger);
        if (rideHome) {
          return;
        }
      }
    }

    // Step 2b: Handle existing monster combat (only if no champion combat occurred or champion won)
    const monsterCombatResult = await handleMonsterCombat(
      this.gameState,
      tile,
      player,
      championId,
      logFn,
      this.playerAgents[this.gameState.currentPlayerIndex],
      this.gameLog,
      thinkingLogger,
      getPlayerAgent
    );
    if (monsterCombatResult.combatOccurred) {
      existingCombatOccurred = true;
      markInteracted();
      if (!monsterCombatResult.championWon) {
        // Champion lost to monster, defeat effects already applied by combat handler
        return;
      }
    }

    // Step 3: Handle Doomspire (impress the dragon or be eaten)
    if (tile.tileType === "doomspire") {
      const doomspireResult = await handleDoomspireTile(
        this.gameState,
        tile,
        player,
        championId,
        logFn,
        this.playerAgents[this.gameState.currentPlayerIndex],
        this.gameLog,
        thinkingLogger,
        getPlayerAgent
      );
      if (doomspireResult.entered) {
        markInteracted();
        if (doomspireResult.gameWon) {
          this.endGameWithRanking(player.name);
          return;
        }
        if (doomspireResult.championEaten) {
          // Champion was eaten by the dragon
          return;
        }
      }
    }

    // Step 4: Handle adventure cards ONLY if no combat has occurred
    // ("If combat has already happened, then don't draw an adventure card. Your knight is too exhausted.")
    if (!existingCombatOccurred) {
      const specialTileResult = handleSpecialTiles(tile, championId, logFn);
      if (specialTileResult.interactionOccurred && specialTileResult.adventureCardDrawn) {
        markInteracted();

        // Draw adventure card
        const adventureCard = this.gameDecks.drawCard(tile.tier!);

        // Log the card draw
        if (adventureCard) {
          logFn("event", `${player.name} drew an adventure card from the tier ${tile.tier} deck`);
        } else {
          logFn("event", `${player.name} drew from tier ${tile.tier} (no card available)`);
        }

        // Handle the adventure card
        // Track statistics
        player.statistics!.adventureCards += 1;

        if (!adventureCard) {
          console.log(`No adventure card found for tier ${tile.tier}`);
        } else {
          const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];
          const adventureResult = await handleAdventureCard(
            adventureCard,
            this.gameState,
            tile,
            player,
            currentPlayerAgent,
            championId,
            this.gameLog,
            logFn,
            thinkingLogger,
            getPlayerAgent
          );

          // If the card should be returned to the deck (e.g., sword-in-stone resisted pull)
          if (adventureResult.cardReturnedToDeck && adventureCard) {
            this.gameDecks.returnCardToTop(tile.tier!, adventureCard);
            logFn("event", `The card returned to the top of the adventure deck.`);
          }

          // Handle results from adventure card
          if (adventureResult.cardProcessed && adventureResult.monsterPlaced) {
            if (adventureResult.monsterPlaced.championDefeated) {
              // Champion was defeated by a monster from the adventure card, defeat effects already applied by combat handler
              return;
            }
          }
        }
      }
    }

    // === Voluntary interactions ===

    // Visiting the temple frees any stuck ring (mysterious ring, outcome 1)
    if (tile.tileType === "temple" && champion) {
      for (const item of champion.items) {
        if (item.stuck && item.treasureCard?.id === "stuck-ring") {
          item.stuck = false;
          logFn("event", `The temple priests remove the stuck ring from Champion${championId}. It can now be dropped.`);
        }
      }
    }

    // Item pickup and drop (does NOT count as a tile interaction)
    if (tileAction?.pickUpItems || tileAction?.dropItems) {
      const itemResult = handleItemManagement(
        this.gameState,
        tile,
        player,
        championId,
        tileAction.pickUpItems || [],
        tileAction.dropItems || [],
        logFn
      );

      // Log any failed actions
      for (const failure of itemResult.failedPickups) {
        logFn("event", `Failed to pick up ${failure.itemId}: ${failure.reason}`);
      }
      for (const failure of itemResult.failedDrops) {
        logFn("event", `Failed to drop ${failure.itemId}: ${failure.reason}`);
      }
    }

    // Trader interactions (once per round)
    if (tile.tileType === "trader" && tileAction?.useTrader) {
      if (player.specialTileUsesThisRound?.trader) {
        logFn("event", `Failed to use trader: already used this round (once per round)`);
      } else {
        await this.handleTraderVisit(player, championId, logFn);
        player.specialTileUsesThisRound = { ...player.specialTileUsesThisRound, trader: true };
        markInteracted();
      }
    }

    // Mercenary camp interactions
    if (tile.tileType === "mercenary" && tileAction?.useMercenary) {
      const mercenaryResult = handleMercenaryAction(
        this.gameState,
        tile,
        player,
        championId,
        true,
        logFn
      );

      if (mercenaryResult.actionSuccessful) {
        markInteracted();
      } else if (mercenaryResult.reason) {
        logFn("event", `Failed to use mercenary camp: ${mercenaryResult.reason}`);
      }
    }

    // Temple interactions
    if (tile.tileType === "temple" && tileAction?.useTemple) {
      const templeResult = handleTempleAction(
        this.gameState,
        tile,
        player,
        championId,
        true,
        logFn
      );

      if (templeResult.actionSuccessful) {
        markInteracted();
      } else if (templeResult.reason) {
        logFn("event", `Failed to use temple: ${templeResult.reason}`);
      }
    }

    // Tile claiming
    if (tileAction?.claimTile && tile.tileType === "resource" && tile.claimedBy === undefined) {
      handleTileClaiming(this.gameState, tile, player, championId, true, logFn);
      markInteracted();
    }

    // Tile takeover (conquer with fame / bribe with gold)
    if (tileAction?.conquer || tileAction?.bribe) {
      const previousOwner = tile.claimedBy;
      handleTileInteractions(
        this.gameState,
        tile,
        player,
        championId,
        !!tileAction?.conquer,
        !!tileAction?.bribe,
        logFn
      );
      if (tile.claimedBy === player.name && previousOwner !== player.name) {
        markInteracted();
      }
    }
  }

  /**
   * After winning a PVP fight at Doomspire, the winner may accept a free ride home
   * from the grateful dragon instead of facing it. Returns true if the ride was taken.
   */
  private async offerDragonRideHome(
    player: Player,
    championId: number,
    logFn: (type: string, content: string) => void,
    thinkingLogger?: (content: string) => void
  ): Promise<boolean> {
    const playerAgent = this.playerAgents[this.gameState.currentPlayerIndex];

    try {
      const decision = await playerAgent.makeDecision(this.gameState, this.gameLog, {
        description: `You defeated the opposing knight at Doomspire! The dragon is delighted. Choose: face the dragon as usual, or accept a free ride home (no impression attempt, no risk).`,
        options: [
          { id: "face_dragon", description: "Face the dragon (impress it or be eaten)" },
          { id: "ride_home", description: "Accept the free ride home (no risk, no impression)" }
        ]
      }, thinkingLogger);

      if (decision.choice === "ride_home") {
        this.gameState.moveChampionToHome(player.name, championId);
        logFn("event", `Champion${championId} accepts a ride home from the grateful dragon.`);
        return true;
      }
    } catch (error) {
      // On error, face the dragon as usual
    }

    return false;
  }

  /**
   * Execute a player's harvest during the harvest phase, using the dice saved during
   * the move phase and the tiles chosen in the harvest decision.
   */
  private executeHarvest(
    player: Player,
    savedDiceValues: number[],
    tilePositions: Position[],
    logFn: (type: string, content: string) => void
  ): void {
    // Fate cards can block harvesting
    if (this.gameState.fateEffects.harvestBlockedForAll) {
      logFn("harvest", `Could not harvest: Famine prevents all harvesting this round.`);
      return;
    }
    if (this.gameState.fateEffects.harvestBlockedForPlayer === player.name) {
      logFn("harvest", `Could not harvest: banned from harvesting this round (Harvest Ban).`);
      return;
    }

    // Use the harvest calculator to determine the results - sum the dice values to get harvest power
    const diceSum = savedDiceValues.reduce((sum, diceValue) => sum + diceValue, 0);
    const harvestResult = calculateHarvest(this.gameState, player.name, tilePositions, diceSum);

    // Bountiful Harvest fate card: double resources
    const multiplier = this.gameState.fateEffects.doubleHarvest ? 2 : 1;

    // Add the harvested resources to the player's pool
    player.resources.food += harvestResult.harvestedResources.food * multiplier;
    player.resources.wood += harvestResult.harvestedResources.wood * multiplier;
    player.resources.ore += harvestResult.harvestedResources.ore * multiplier;
    player.resources.gold += harvestResult.harvestedResources.gold * multiplier;

    const doubledText = multiplier > 1 ? " (doubled by Bountiful Harvest)" : "";

    const gainedResources = {
      food: harvestResult.harvestedResources.food * multiplier,
      wood: harvestResult.harvestedResources.wood * multiplier,
      ore: harvestResult.harvestedResources.ore * multiplier,
      gold: harvestResult.harvestedResources.gold * multiplier,
    };

    // Log the harvest action
    const diceString = savedDiceValues.map(die => `[${die}]`).join("+");
    if (harvestResult.harvestedTileCount > 0) {
      const tilesString = harvestResult.harvestedTilePositions.map(p => formatPosition(p)).join(", ");
      logFn(
        "harvest",
        `Harvested from ${harvestResult.harvestedTileCount} tile${harvestResult.harvestedTileCount > 1 ? "s" : ""} (${tilesString}) and gained ${formatResources(gainedResources, " + ")}${doubledText}, using saved dice ${diceString}.`
      );
    } else {
      logFn("harvest", `Saved dice ${diceString} for harvesting, but no eligible tiles were harvested.`);
    }
  }

  /**
   * Handle trader visit when a champion arrives at a trader tile with useTrader=true
   */
  private async handleTraderVisit(
    player: Player,
    championId: number,
    logFn: (type: string, content: string) => void
  ): Promise<void> {
    // Create trader context
    const traderContext = createTraderContext(player, this.gameDecks, this.gameState);

    // Get the current player agent
    const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];

    // Ask player to make trader decisions
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);
    const traderDecision = await currentPlayerAgent.makeTraderDecision(this.gameState, this.gameLog, traderContext, thinkingLogger);

    // Handle the trader interaction
    const traderResult = handleTraderInteraction(this.gameState, player, championId, traderDecision, this.gameDecks, logFn);

    // Log any failed actions
    if (traderResult.failedActions.length > 0) {
      for (const failure of traderResult.failedActions) {
        logFn("event", `Failed trader action: ${failure.reason}`);
      }
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
   * Add an entry to the game log.
   *
   * Entries during the move and harvest phases are attributed to the current player.
   * Fate and roll phase entries are table-wide (no player attribution), since they happen
   * for all players together - the content itself names any affected players.
   */
  private addGameLogEntry(type: GameLogEntryType, content: string): void {
    const isPlayerScopedPhase = this.currentPhase === "move" || this.currentPhase === "harvest";
    const playerName = isPlayerScopedPhase && type !== "victory" ? this.gameState.getCurrentPlayer().name : undefined;
    const entry: GameLogEntry = {
      round: this.gameState.currentRound,
      phase: this.currentPhase,
      playerName: playerName,
      type: type,
      content: content,
    };
    console.log(`${entry.playerName ?? "(all)"} ${entry.type}: ${entry.content}`);
    this.gameLog.push(entry);
  }

  /**
 * Get the game decks for UI display
 */
  public getGameDecks(): GameDecks {
    return this.gameDecks;
  }

  /**
   * Get the fate card drawn for the current round (null before the first round starts)
   */
  public getCurrentFateCard(): FateCard | null {
    return this.currentFateCard;
  }

  /**
   * Get match statistics as CSV string
   */
  public getStatisticsCSV(): string {
    return this.statisticsCollector.exportToCSV();
  }

  /**
   * Get raw statistics data for visualization
   */
  public getStatistics(): readonly import("../lib/types").TurnStatistics[] {
    return this.statisticsCollector.getTurnHistory();
  }

  private endGame(winnerName?: string, condition?: string): void {
    this.masterState = "finished";

    if (winnerName !== undefined) {
      const winner = this.playerAgents.find(agent => agent.getName() === winnerName);
      console.log(`\n🎉 GAME WON! 🎉`);
      console.log(`Winner: ${winner?.getName() || winnerName}`);
      if (condition) {
        console.log(`Victory Condition: ${condition}`);
      }

      this.addGameLogEntry("victory", `VICTORY! ${condition || "Game won"}`);
    } else {
      console.log(`\nGame ended without a winner`);
      this.addGameLogEntry("victory", "Game ended without a winner");
    }

    this.gameState.gameEnded = true;
    // Find the player index for the winner
    const winnerIndex = winnerName ? this.gameState.players.findIndex(p => p.name === winnerName) : undefined;
    this.gameState.winner = winnerIndex;
  }

  private endGameWithRanking(kingName: string): void {
    this.masterState = "finished";
    this.gameState.gameEnded = true;

    // Establish final ranking according to the rules
    const players = [...this.gameState.players];

    // 1. King of Doomspire: The first player to impress the dragon twice
    const king = players.find(p => p.name === kingName)!;
    king.finalRank = "King of Doomspire";

    // Get remaining players
    const remainingPlayers = players.filter(p => p.name !== kingName);

    // 2. Hand of the King: Player with the most resource tiles claimed
    // Tiebreaker: most starred resource tiles. If still tied, King decides (randomized in the simulator)
    const handOfKing = this.findHandOfKing(remainingPlayers);
    handOfKing.finalRank = "Hand of the King";

    // 3. Master of Coin: Player with the most gold from remaining players
    // Tiebreaker: total resources. If still tied, King decides (randomized in the simulator)
    const finalRemaining = remainingPlayers.filter(p => p !== handOfKing);
    const masterOfCoin = this.findMasterOfCoin(finalRemaining);
    masterOfCoin.finalRank = "Master of Coin";

    // 4. Court Jester: The remaining player
    const jester = finalRemaining.find(p => p !== masterOfCoin)!;
    jester.finalRank = "Court Jester";

    // Log the final rankings
    this.addGameLogEntry("victory", `GAME ENDED! Final Rankings:`);
    this.addGameLogEntry("victory", `👑 King of Doomspire: ${king.name}`);
    this.addGameLogEntry("victory", `🤝 Hand of the King: ${handOfKing.name}`);
    this.addGameLogEntry("victory", `💰 Master of Coin: ${masterOfCoin.name}`);
    this.addGameLogEntry("victory", `🃏 Court Jester: ${jester.name}`);

    console.log(`\n🎉 GAME ENDED! Final Rankings:`);
    console.log(`👑 King of Doomspire: ${king.name}`);
    console.log(`🤝 Hand of the King: ${handOfKing.name}`);
    console.log(`💰 Master of Coin: ${masterOfCoin.name}`);
    console.log(`🃏 Court Jester: ${jester.name}`);

    // Set winner index for compatibility
    this.gameState.winner = this.gameState.players.findIndex(p => p.name === kingName);
  }

  private findHandOfKing(players: Player[]): Player {
    if (players.length === 0) throw new Error("No players to choose from");

    // Count claimed resource tiles for each player (the home tile counts as a resource tile)
    const playerTileData = players.map(player => {
      const claimedTiles = this.gameState.board.findTiles(
        tile => tile.claimedBy === player.name && (tile.tileType === "resource" || tile.tileType === "home")
      );
      const starredTiles = claimedTiles.filter(tile => tile.isStarred).length;

      return {
        player,
        totalTiles: claimedTiles.length,
        starredTiles
      };
    });

    // Sort by: most resource tiles, then most starred tiles. If still tied, King decides (randomized)
    playerTileData.sort((a, b) => {
      if (a.totalTiles !== b.totalTiles) return b.totalTiles - a.totalTiles;
      if (a.starredTiles !== b.starredTiles) return b.starredTiles - a.starredTiles;
      return Math.random() - 0.5; // "King decides" - randomized in the simulator
    });

    return playerTileData[0].player;
  }

  private findMasterOfCoin(players: Player[]): Player {
    if (players.length === 0) throw new Error("No players to choose from");

    const playerGoldData = players.map(player => {
      const totalResourceValue = player.resources.gold + player.resources.food + player.resources.wood + player.resources.ore;
      return {
        player,
        gold: player.resources.gold,
        totalResourceValue
      };
    });

    // Sort by: most gold, then total resource value. If still tied, King decides (randomized)
    playerGoldData.sort((a, b) => {
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.totalResourceValue !== b.totalResourceValue) return b.totalResourceValue - a.totalResourceValue;
      return Math.random() - 0.5; // "King decides" - randomized in the simulator
    });

    return playerGoldData[0].player;
  }

  private printGameSummary(): void {
    console.log(`\nGame completed after ${this.gameState.currentRound} rounds`);
    console.log(`Total log entries: ${this.gameLog.length}`);

    // Print final player states
    console.log("\nFinal Player States:");
    for (const player of this.gameState.players) {
      console.log(`${player.name}: Fame=${player.fame}, Might=${player.might}, Resources=${formatResources(player.resources)}`);
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
