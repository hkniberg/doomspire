// Lords of Doomspire Game Master

import { BoatAction, ChampionAction, HarvestAction, TileAction } from "@/lib/actionTypes";
import { TokenUsageTracker } from "@/lib/TokenUsageTracker";
import { GameLogEntry, GameLogEntryType, Player, Tile, TurnContext } from "@/lib/types";
import { formatPosition, formatResources } from "@/lib/utils";
import { GameState } from "../game/GameState";
import { stringifyTileForGameLog } from "../game/gameStateStringifier";
import { CARDS, GameDecks } from "../lib/cards";
import { PlayerAgent } from "../players/PlayerAgent";
import { calculateHarvest } from "./actions/harvestCalculator";
import { calculateBoatMove, calculateChampionMove } from "./actions/moveCalculator";
import { checkVictory } from "./actions/victoryChecker";
import { DiceRoller, RandomDiceRoller } from "./DiceRoller";
import { DiceRolls } from "./DiceRolls";
import { handleAdventureCard } from "./handlers/adventureCardHandler";
import { handleBuildingUsage as handleBuildingUsageHandler } from "./handlers/buildingUsageHandler";
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

export type GameMasterState = "setup" | "playing" | "finished";

export interface GameMasterConfig {
  players: PlayerAgent[];
  maxRounds?: number; // Optional limit for testing
  startingValues?: { fame?: number; might?: number; food?: number; wood?: number; ore?: number; gold?: number }; // Optional starting values
  seed?: number; // Optional seed for board generation
  tokenUsageTracker?: TokenUsageTracker; // Optional shared token usage tracker
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
  private tokenUsageTracker: TokenUsageTracker;

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
    // Use provided tracker or create a new one
    this.tokenUsageTracker = config.tokenUsageTracker || new TokenUsageTracker();
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
   * Execute a single turn for the current player using the new Game Master pattern
   */
  public async executeTurn(onStepUpdate?: () => void): Promise<void> {
    if (this.masterState !== "playing") {
      throw new Error(`Cannot execute turn: session is in state ${this.masterState}`);
    }

    const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];
    const playerId = this.gameState.currentPlayerIndex; // Use index as player ID

    console.log(`\n--- ${currentPlayerAgent.getName()}'s Turn (Round ${this.gameState.currentRound}) ---`);

    // Step 1: Roll dice for player
    const currentPlayer = this.gameState.getCurrentPlayer();
    const championCount = currentPlayer.champions.length;
    const totalDiceCount = 1 + championCount;

    // Calculate dice tax: 2 food per die after the first 2
    const freeDice = GameSettings.FREE_DICE_COUNT;
    const taxedDice = Math.max(0, totalDiceCount - freeDice);
    const foodCost = taxedDice * GameSettings.DICE_TAX_FOOD_PER_DIE;

    // Check if player can afford the dice tax
    const affordableDice = currentPlayer.resources.food >= foodCost ? totalDiceCount : freeDice + Math.floor(currentPlayer.resources.food / GameSettings.DICE_TAX_FOOD_PER_DIE);
    const actualDiceCount = Math.min(totalDiceCount, affordableDice);
    const actualFoodCost = Math.min(foodCost, currentPlayer.resources.food);

    // Deduct food cost
    currentPlayer.resources.food -= actualFoodCost;

    // Log dice tax information
    if (taxedDice > 0) {
      if (actualDiceCount < totalDiceCount) {
        const lostDice = totalDiceCount - actualDiceCount;
        this.addGameLogEntry("dice", `Lost ${lostDice} dice due to insufficient food (dice tax: ${foodCost} food needed).`);
      }
      // Removed the else clause that logged when player could afford all dice
    }

    const diceRollValues = this.diceRoller.rollMultipleD3(actualDiceCount);
    const diceRolls = new DiceRolls(diceRollValues);

    this.addGameLogEntry("dice", `Rolled ${actualDiceCount} dice: ${diceRollValues.map(die => `[${die}]`).join(", ")}`);

    // Notify UI of dice roll update
    if (onStepUpdate) {
      onStepUpdate();
    }

    // Step 2: Ask player for strategic assessment (strategic reflection) - now with dice context
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);

    try {
      if (currentPlayerAgent.makeStrategicAssessment) {
        const adventureDeckThemes = this.gameDecks.getAdventureDeckThemes();
        const strategicAssessment = await currentPlayerAgent.makeStrategicAssessment(this.gameState, this.gameLog, diceRollValues, this.gameState.currentRound, this.gameDecks.getAvailableTraderCards(), adventureDeckThemes, thinkingLogger);
        if (strategicAssessment) {
          this.addGameLogEntry("assessment", strategicAssessment);
        }
      }
    } catch (error) {
      console.error("Error during strategic assessment:", error);
      this.addGameLogEntry("error", `Strategic assessment failed: ${error instanceof Error ? error.message : String(error)}`);
      // Continue with the turn despite the assessment failure
    }

    // Notify UI of strategic assessment update
    if (onStepUpdate) {
      onStepUpdate();
    }

    // Step 3: Ask the player to execute actions until they run out of dice.
    let currentState = this.gameState;

    while (diceRolls.hasRemainingRolls()) {
      // Create turn context for this die
      const turnContext: TurnContext = {
        turnNumber: this.gameState.currentRound,
        diceRolled: diceRollValues,
        remainingDiceValues: diceRolls.getRemainingRolls(),
      };

      try {
        // Ask player decide on a dice action
        const diceAction = await currentPlayerAgent.decideDiceAction(currentState, this.gameLog, turnContext, thinkingLogger);

        // Execute the action and consume the appropriate dice
        const actionType = diceAction.actionType;
        if (actionType == "championAction") {
          const championAction = diceAction.championAction!;
          diceRolls.consumeDiceRoll(championAction.diceValueUsed);
          await this.executeChampionAction(currentPlayer, championAction, diceAction.reasoning);
          // Track statistics
          if (currentPlayer.statistics) {
            currentPlayer.statistics.championActions += 1;
          }
        } else if (actionType === "boatAction") {
          const boatAction = diceAction.boatAction!;
          diceRolls.consumeDiceRoll(boatAction.diceValueUsed);
          await this.executeBoatAction(currentPlayer, boatAction, diceAction.reasoning);
          // Track statistics
          if (currentPlayer.statistics) {
            currentPlayer.statistics.boatActions += 1;
          }
        } else if (actionType === "harvestAction") {
          const harvestAction = diceAction.harvestAction!;
          diceRolls.consumeMultipleDiceRolls(harvestAction.diceValuesUsed);
          await this.executeHarvestAction(currentPlayer, harvestAction, diceAction.reasoning);
          // Track statistics
          if (currentPlayer.statistics) {
            currentPlayer.statistics.harvestActions += 1;
          }
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

      // Notify UI of dice action update
      if (onStepUpdate) {
        onStepUpdate();
      }

      // Step 4: Check for victory conditions
      const victoryCheck = checkVictory(this.gameState);
      if (victoryCheck.won) {
        this.endGame(victoryCheck.playerName, victoryCheck.condition);
        return;
      }

    }

    // Step 5: After all dice are consumed, check for building usage
    try {
      await this.handleBuildingUsage(currentPlayer, currentPlayerAgent, thinkingLogger);
    } catch (error) {
      console.error("Error during building usage:", error);
      this.addGameLogEntry("error", `Building usage failed: ${error instanceof Error ? error.message : String(error)}`);
      // Continue with the turn despite the building usage failure
    }

    // Notify UI of building usage update
    if (onStepUpdate) {
      onStepUpdate();
    }

    // Check for max rounds limit
    if (this.gameState.currentRound >= this.maxRounds) {
      console.log(`\nGame ended: Maximum rounds (${this.maxRounds}) reached`);
      this.endGame();
      return;
    }

    // Step 6: Capture turn statistics before advancing to next player
    this.statisticsCollector.captureTurnStatistics(this.gameState);

    // Step 7: Advance to next player
    const previousRound = this.gameState.currentRound;
    const previousStartPlayer = this.gameState.getStartingPlayer().name;
    this.gameState = this.gameState.advanceToNextPlayer();

    // Log starting player token rotation
    if (this.gameState.currentRound > previousRound) {
      const newStartPlayer = this.gameState.getStartingPlayer().name;
      if (newStartPlayer !== previousStartPlayer) {
        this.addGameLogEntry("system", `Starting player token passes to ${newStartPlayer} for Round ${this.gameState.currentRound}`);
      }
    }
  }





  private async executeChampionAction(
    player: Player,
    action: ChampionAction,
    reasoning?: string,
  ): Promise<void> {

    // Get the champion's current position before moving
    const champion = this.gameState.getChampion(player.name, action.championId);
    if (!champion) {
      throw new Error(`Champion ${action.championId} not found for player ${player.name}`);
    }
    const startPosition = champion.position;

    // Handle movement if a path is provided
    let endPosition = startPosition;
    if (action.movementPathIncludingStartPosition && action.movementPathIncludingStartPosition.length > 1) {
      // Execute the movement calculation
      const moveResult = calculateChampionMove(this.gameState, player.name, action.movementPathIncludingStartPosition, action.diceValueUsed);

      // Update champion position 
      const tile = this.gameState.updateChampionPosition(player.name, action.championId, moveResult.endPosition);

      // Check if champion actually moved to a different position
      const actuallyMoved = startPosition.row !== moveResult.endPosition.row || startPosition.col !== moveResult.endPosition.col;

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

      if (actuallyMoved) {
        this.addGameLogEntry("movement", `Champion${action.championId} moved from ${formatPosition(startPosition)} to ${formatPosition(moveResult.endPosition)}, using dice value [${action.diceValueUsed}]. ${tileDescription}${reasoningText}`);
      } else {
        this.addGameLogEntry("movement", `Champion${action.championId} stayed in ${formatPosition(startPosition)}, using dice value [${action.diceValueUsed}]. ${tileDescription}${reasoningText}`);
      }
      endPosition = moveResult.endPosition;
    } else {
      // Champion is staying in place, just log the action
      const tile = this.gameState.getTile(startPosition);
      const tileDescription = tile ? stringifyTileForGameLog(tile, this.gameState, player.name) : "This is an unknown tile.";
      const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";
      this.addGameLogEntry("movement", `Champion${action.championId} stayed in ${formatPosition(startPosition)}, using dice value [${action.diceValueUsed}].${reasoningText} ${tileDescription}`);
    }

    // Get the tile at the final position for arrival handling
    const tile = this.gameState.getTile(endPosition);
    if (!tile) {
      throw new Error(`No tile found at position ${formatPosition(endPosition)}`);
    }

    await this.executeChampionArrivalAtTile(player, tile, action.championId, action.tileAction);
  }

  private async executeBoatAction(player: Player, action: BoatAction, reasoning?: string): Promise<void> {
    const championId = action.championIdToPickUp;
    const champion = championId ? this.gameState.getChampion(player.name, championId) : undefined;
    const championStartPosition = champion ? champion.position : undefined;
    const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";

    // Handle boat movement if a path is provided
    if (action.movementPathIncludingStartPosition && action.movementPathIncludingStartPosition.length > 0) {
      const boatMoveResult = calculateBoatMove(action.movementPathIncludingStartPosition, action.diceValueUsed, championStartPosition, action.championDropPosition);

      // Get boat start position for logging
      const boatStartPosition = action.movementPathIncludingStartPosition[0];

      // Update the boat's actual position in the game state
      const boat = player.boats.find(b => b.id === action.boatId);
      if (!boat) {
        throw new Error(`Boat ${action.boatId} not found for player ${player.name}`);
      }
      boat.position = boatMoveResult.endPosition;

      if (boatMoveResult.championMoveResult === "championMoved" && championId !== undefined && action.championDropPosition) {
        const tile = this.gameState.updateChampionPosition(player.name, championId, action.championDropPosition);
        const tileDescription = stringifyTileForGameLog(tile, this.gameState, player.name);
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition}, transporting champion ${championId} from ${formatPosition(championStartPosition!)} to ${formatPosition(action.championDropPosition)}, using dice value [${action.diceValueUsed}]. Champion arrived: ${tileDescription}.${reasoningText}`);
        await this.executeChampionArrivalAtTile(player, tile, championId, action.championTileAction);
      } else if (boatMoveResult.championMoveResult === "championNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to move champion ${championId} at ${formatPosition(championStartPosition!)} but the champion was not reachable by this boat, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else if (boatMoveResult.championMoveResult === "targetPositionNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to move champion ${championId} to ${formatPosition(action.championDropPosition!)} but that position was not reachable by this boat, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else {
        // Handle case where boat moves but no champion transport was requested or possible
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition}, using dice value [${action.diceValueUsed}].${reasoningText}`);
      }
    } else {
      // Boat is staying in place but still using a die
      this.addGameLogEntry("boat", `Boat ${action.boatId} stayed in position, using dice value [${action.diceValueUsed}].${reasoningText}`);

      // If there's a champion to pick up and drop off without moving the boat
      if (championId && action.championDropPosition) {
        const tile = this.gameState.updateChampionPosition(player.name, championId, action.championDropPosition);
        const tileDescription = stringifyTileForGameLog(tile, this.gameState, player.name);
        this.addGameLogEntry("boat", `Champion ${championId} transported from ${formatPosition(championStartPosition!)} to ${formatPosition(action.championDropPosition)} without moving boat. Champion arrived: ${tileDescription}`);
        await this.executeChampionArrivalAtTile(player, tile, championId, action.championTileAction);
      }
    }
  }

  private async executeChampionArrivalAtTile(player: Player, tile: Tile, championId: number, tileAction: TileAction | undefined): Promise<void> {
    // Create logging wrappers that match the handler's expected signature
    const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);

    // Determine if combat was actively chosen based on tile state and movement
    const hadOpposingChampions = this.gameState.getOpposingChampionsAtPosition(player.name, tile.position).length > 0;
    const hadMonster = tile.monster !== undefined;
    const isDoomspireAlreadyExplored = tile.tileType === "doomspire" && tile.explored;

    // Combat is actively chosen if:
    // 1. Moved to a tile that already had opposing champions or monsters
    // 2. Entered Doomspire when it was already explored (knew dragon was there)
    const isChampionCombatActivelyChosen = hadOpposingChampions;
    const isMonsterCombatActivelyChosen = hadMonster;
    const isDragonCombatActivelyChosen = isDoomspireAlreadyExplored;

    // Step 1: Handle exploration
    handleExploration(this.gameState, tile, player, logFn);

    // Step 2: Handle ALL existing combat first (this takes priority over adventure cards)
    let existingCombatOccurred = false;

    // Step 2a: Handle champion combat
    const getPlayerAgent = (playerName: string) => {
      const playerIndex = this.gameState.players.findIndex(p => p.name === playerName);
      return playerIndex >= 0 ? this.playerAgents[playerIndex] : undefined;
    };

    const championCombatResult = await handleChampionCombat(
      this.gameState,
      tile,
      player,
      championId,
      this.playerAgents[this.gameState.currentPlayerIndex],
      this.gameLog,
      logFn,
      thinkingLogger,
      getPlayerAgent,
      isChampionCombatActivelyChosen
    );
    if (championCombatResult.combatOccurred) {
      existingCombatOccurred = true;
      if (!championCombatResult.attackerWon) {
        // Attacker lost, defeat effects already applied by combat handler
        return;
      }
    }

    // Step 2b: Handle existing monster combat (only if no champion combat occurred or champion won)
    const monsterCombatResult = await handleMonsterCombat(
      this.gameState,
      tile,
      player,
      championId,
      logFn,
      isMonsterCombatActivelyChosen,
      this.playerAgents[this.gameState.currentPlayerIndex],
      this.gameLog,
      thinkingLogger
    );
    if (monsterCombatResult.combatOccurred) {
      existingCombatOccurred = true;
      if (!monsterCombatResult.championWon) {
        // Champion lost to monster, defeat effects already applied by combat handler
        return;
      }
    }

    // Step 3: Handle adventure cards ONLY if no existing combat occurred
    // This follows the rule: "if you enter an adventure tile with a monster already present, 
    // you will be forced to fight the monster but not draw another adventure card after"
    if (!existingCombatOccurred) {
      const specialTileResult = handleSpecialTiles(tile, championId, logFn);
      if (specialTileResult.interactionOccurred && specialTileResult.adventureCardDrawn) {
        // Draw adventure card using simplified API
        const adventureCard = this.gameDecks.drawCard(tile.tier!);

        // Log the card draw
        if (adventureCard) {
          const themeDisplayName = adventureCard.theme.charAt(0).toUpperCase() + adventureCard.theme.slice(1);
          logFn("event", `${player.name} drew from tier ${tile.tier} (a ${themeDisplayName} card)`);
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

    // Step 4: Handle Doomspire tile (dragon combat and victory conditions)
    const doomspireResult = await handleDoomspireTile(
      this.gameState,
      tile,
      player,
      championId,
      logFn,
      isDragonCombatActivelyChosen,
      this.playerAgents[this.gameState.currentPlayerIndex],
      this.gameLog,
      thinkingLogger
    );
    if (doomspireResult.entered) {
      if (doomspireResult.alternativeVictory) {
        // Check if this is a final impression that ends the game
        if (doomspireResult.alternativeVictory.type.includes("Final Impression")) {
          this.endGameWithRanking(doomspireResult.alternativeVictory.playerName);
          return;
        } else {
          this.endGameWithRanking(doomspireResult.alternativeVictory.playerName);
          return;
        }
      }
      if (doomspireResult.dragonImpressed) {
        // Dragon was impressed but game continues (not the final impression yet)
        logFn("system", `Dragon impressed ${doomspireResult.dragonImpressed.impressionCount} time(s). Game continues.`);
      }
      if (doomspireResult.dragonCombat) {
        if (doomspireResult.dragonCombat.combatVictory) {
          this.endGameWithRanking(doomspireResult.dragonCombat.combatVictory.playerName);
          return;
        } else if (doomspireResult.dragonCombat.championDefeated) {
          // Champion defeated by dragon, defeat effects already applied by combat handler
          return;
        }
        // If dragon combat occurred but champion wasn't defeated, they might have fled
        // In that case, we continue with the rest of the tile actions
      }
    }

    // Step 5: Handle item pickup and drop
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


    // Step 6: Handle trader interactions
    if (tile.tileType === "trader" && tileAction?.useTrader) {
      await this.handleTraderVisit(player, championId, logFn);
    }

    // Step 7: Handle mercenary camp interactions
    if (tile.tileType === "mercenary" && tileAction?.useMercenary) {
      const mercenaryResult = handleMercenaryAction(
        this.gameState,
        tile,
        player,
        championId,
        true,
        logFn
      );

      if (!mercenaryResult.actionSuccessful && mercenaryResult.reason) {
        logFn("event", `Failed to use mercenary camp: ${mercenaryResult.reason}`);
      }
    }

    // Step 8: Handle temple interactions
    if (tile.tileType === "temple" && tileAction?.useTemple) {
      const templeResult = handleTempleAction(
        this.gameState,
        tile,
        player,
        championId,
        true,
        logFn
      );

      if (!templeResult.actionSuccessful && templeResult.reason) {
        logFn("event", `Failed to use temple: ${templeResult.reason}`);
      }
    }

    // Step 9: Handle tile claiming
    handleTileClaiming(this.gameState, tile, player, championId, !!tileAction?.claimTile, logFn);

    // Step 10: Handle tile conquest and revolt
    handleTileInteractions(
      this.gameState,
      tile,
      player,
      championId,
      !!tileAction?.conquerWithMight,
      !!tileAction?.inciteRevolt,
      logFn
    );
  }

  private async executeHarvestAction(player: Player, action: HarvestAction, reasoning?: string): Promise<void> {
    // Use the harvest calculator to determine the results - sum the dice values to get harvest power
    const diceSum = action.diceValuesUsed.reduce((sum, diceValue) => sum + diceValue, 0);
    const harvestResult = calculateHarvest(this.gameState, player.name, action.tilePositions, diceSum);

    // Add the harvested resources to the player's pool
    player.resources.food += harvestResult.harvestedResources.food;
    player.resources.wood += harvestResult.harvestedResources.wood;
    player.resources.ore += harvestResult.harvestedResources.ore;
    player.resources.gold += harvestResult.harvestedResources.gold;

    const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";

    // Log the harvest action
    if (harvestResult.harvestedTileCount > 0) {
      if (action.diceValuesUsed.length === 1) {
        this.addGameLogEntry(
          "harvest",
          `Harvested from ${harvestResult.harvestedTileCount} tile${harvestResult.harvestedTileCount > 1 ? "s" : ""} and gained ${formatResources(harvestResult.harvestedResources, " + ")}, using die value [${action.diceValuesUsed[0]}].${reasoningText}`
        );
      } else {
        const diceString = action.diceValuesUsed.map(die => `[${die}]`).join("+");
        this.addGameLogEntry(
          "harvest",
          `Harvested from ${harvestResult.harvestedTileCount} tiles and gained ${formatResources(harvestResult.harvestedResources, " + ")}, using die values ${diceString}.${reasoningText}`
        );
      }
    } else {
      this.addGameLogEntry("harvest", `Attempted to harvest but no tiles were harvestable for some reason.${reasoningText}`);
    }
  }

  private async handleBuildingUsage(
    player: Player,
    playerAgent: PlayerAgent,
    thinkingLogger?: (content: string) => void
  ): Promise<void> {
    const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);

    await handleBuildingUsageHandler(
      player,
      playerAgent,
      this.gameState,
      this.gameLog,
      logFn,
      thinkingLogger
    );
  }

  /**
   * Handle trader visit when a champion arrives at a trader tile with purchaseAtTrader=true
   */
  private async handleTraderVisit(
    player: Player,
    championId: number,
    logFn: (type: string, content: string) => void
  ): Promise<void> {
    // Create trader context
    const traderContext = createTraderContext(player, this.gameDecks);

    // Get the current player agent
    const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];

    // Ask player to make trader decisions
    console.log("traderContext", traderContext);
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);
    const traderDecision = await currentPlayerAgent.makeTraderDecision(this.gameState, this.gameLog, traderContext, thinkingLogger);
    console.log("traderDecision", traderDecision);

    // Handle the trader interaction
    const traderResult = handleTraderInteraction(this.gameState, player, championId, traderDecision, this.gameDecks, logFn);
    console.log("traderResult", traderResult);

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
   * Add an entry to the game log
   */
  private addGameLogEntry(type: GameLogEntryType, content: string): void {
    const entry: GameLogEntry = {
      round: this.gameState.currentRound,
      playerName: this.gameState.getCurrentPlayer().name,
      type: type,
      content: content,
    };
    console.log(`${entry.playerName} ${entry.type}: ${entry.content}`);
    this.gameLog.push(entry);
  }

  /**
 * Get the game decks for UI display
 */
  public getGameDecks(): GameDecks {
    return this.gameDecks;
  }

  /**
   * Get the token usage tracker for monitoring Claude API costs
   */
  public getTokenUsageTracker(): TokenUsageTracker {
    return this.tokenUsageTracker;
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

      this.addGameLogEntry("system", `VICTORY! ${condition || "Game won"}`);
    } else {
      console.log(`\nGame ended without a winner`);
      this.addGameLogEntry("system", "Game ended without a winner");
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

    // 1. King of Doomspire: The last player to impress the dragon
    const king = players.find(p => p.name === kingName)!;
    king.finalRank = "King of Doomspire";

    // Get remaining players
    const remainingPlayers = players.filter(p => p.name !== kingName);

    // 2. Hand of the King: Player with the most resource tiles claimed
    // Tiebreaker: most starred resource tiles, then most gold. If still tied, King decides (randomize)
    const handOfKing = this.findHandOfKing(remainingPlayers);
    handOfKing.finalRank = "Hand of the King";

    // 3. Master of Coin: Player with the most gold from remaining players
    // Tiebreaker: total value of all resources. If still tied, King decides (randomize)
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

    // Count resource tiles for each player
    const playerTileData = players.map(player => {
      const resourceTiles = this.gameState.board.findTiles(
        tile => tile.tileType === "resource" && tile.claimedBy === player.name
      );
      const starredTiles = resourceTiles.filter(tile => tile.isStarred).length;

      return {
        player,
        totalTiles: resourceTiles.length,
        starredTiles,
        gold: player.resources.gold
      };
    });

    // Sort by: most resource tiles, then most starred tiles, then most gold
    playerTileData.sort((a, b) => {
      if (a.totalTiles !== b.totalTiles) return b.totalTiles - a.totalTiles;
      if (a.starredTiles !== b.starredTiles) return b.starredTiles - a.starredTiles;
      if (a.gold !== b.gold) return b.gold - a.gold;
      return Math.random() - 0.5; // Random tiebreaker if still tied
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

    // Sort by: most gold, then total resource value
    playerGoldData.sort((a, b) => {
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.totalResourceValue !== b.totalResourceValue) return b.totalResourceValue - a.totalResourceValue;
      return Math.random() - 0.5; // Random tiebreaker if still tied
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
