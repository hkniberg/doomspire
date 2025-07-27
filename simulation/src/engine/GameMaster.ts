// Lords of Doomspire Game Master

import { BoatAction, BuildAction, ChampionAction, HarvestAction, TileAction } from "@/lib/actionTypes";
import { GameLogEntry, GameLogEntryType, Player, Tile, TurnContext } from "@/lib/types";
import { formatPosition, formatResources } from "@/lib/utils";
import { GameState } from "../game/GameState";
import { stringifyTile } from "../game/gameStateStringifier";
import { CARDS, GameDecks } from "../lib/cards";
import { PlayerAgent } from "../players/PlayerAgent";
import { calculateHarvest } from "./actions/harvestCalculator";
import { calculateBoatMove, calculateChampionMove } from "./actions/moveCalculator";
import { checkVictory } from "./actions/victoryChecker";
import { DiceRoller, RandomDiceRoller } from "./DiceRoller";
import { DiceRolls } from "./DiceRolls";
import { handleAdventureCard } from "./handlers/adventureCardHandler";
import {
  handleChampionCombat,
  handleDoomspireTile,
  handleExploration,
  handleMonsterCombat,
  handleSpecialTiles,
  handleTileClaiming
} from "./handlers/tileArrivalHandler";
import { createTraderContext, handleTraderInteraction } from "./handlers/traderHandler";

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
  public async executeTurn(): Promise<void> {
    if (this.masterState !== "playing") {
      throw new Error(`Cannot execute turn: session is in state ${this.masterState}`);
    }

    const currentPlayerAgent = this.playerAgents[this.gameState.currentPlayerIndex];
    const playerId = this.gameState.currentPlayerIndex; // Use index as player ID

    console.log(`\n--- ${currentPlayerAgent.getName()}'s Turn (Round ${this.gameState.currentRound}) ---`);

    // Step 1: Roll dice for player
    const currentPlayer = this.gameState.getCurrentPlayer();
    const championCount = currentPlayer.champions.length;
    const diceCount = 1 + championCount;
    const diceRollValues = this.diceRoller.rollMultipleD3(diceCount);
    const diceRolls = new DiceRolls(diceRollValues);

    this.addGameLogEntry("dice", `Rolled dice: ${diceRollValues.map(die => `[${die}]`).join(", ")}`);

    // Step 2: Ask player for strategic assessment (strategic reflection) - now with dice context
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);
    const strategicAssessment = await currentPlayerAgent.makeStrategicAssessment(this.gameState, this.gameLog, diceRollValues, thinkingLogger);
    if (strategicAssessment) {
      this.addGameLogEntry("assessment", strategicAssessment);
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

      // Ask player decide on a dice action
      const diceAction = await currentPlayerAgent.decideDiceAction(currentState, this.gameLog, turnContext, thinkingLogger);

      // Execute the action and consume the appropriate dice
      const actionType = diceAction.actionType;
      if (actionType == "championAction") {
        const championAction = diceAction.championAction!;
        diceRolls.consumeDiceRoll(championAction.diceValueUsed);
        await this.executeChampionAction(currentPlayer, championAction, diceAction.reasoning);
      } else if (actionType === "boatAction") {
        const boatAction = diceAction.boatAction!;
        diceRolls.consumeDiceRoll(boatAction.diceValueUsed);
        await this.executeBoatAction(currentPlayer, boatAction, diceAction.reasoning);
      } else if (actionType === "harvestAction") {
        const harvestAction = diceAction.harvestAction!;
        diceRolls.consumeMultipleDiceRolls(harvestAction.diceValuesUsed);
        await this.executeHarvestAction(currentPlayer, harvestAction, diceAction.reasoning);
      } else if (actionType === "buildAction") {
        const buildAction = diceAction.buildAction!;
        diceRolls.consumeDiceRoll(buildAction.diceValueUsed);
        await this.executeBuildAction(currentPlayer, buildAction, diceAction.reasoning);
      } else {
        throw new Error(`Unknown action type: ${actionType}`);
      }

      // Step 4: Check for victory conditions
      const victoryCheck = checkVictory(this.gameState);
      if (victoryCheck.won) {
        this.endGame(victoryCheck.playerName, victoryCheck.condition);
        return;
      }

    }

    // Step 5: After all dice are consumed, check for building usage
    await this.handleBuildingUsage(currentPlayer, currentPlayerAgent, thinkingLogger);

    // Check for max rounds limit
    if (this.gameState.currentRound >= this.maxRounds) {
      console.log(`\nGame ended: Maximum rounds (${this.maxRounds}) reached`);
      this.endGame();
      return;
    }

    // Step 6: Advance to next player
    this.gameState = this.gameState.advanceToNextPlayer();
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
      const tileDescription = stringifyTile(tile, this.gameState, player.name);
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
      const tileDescription = tile ? stringifyTile(tile, this.gameState, player.name) : "This is an unknown tile.";
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

      if (boatMoveResult.championMoveResult === "championMoved") {
        const tile = this.gameState.updateChampionPosition(player.name, championId!, action.championDropPosition!);
        const tileDescription = stringifyTile(tile, this.gameState, player.name);
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition}, transporting champion ${championId} from ${formatPosition(championStartPosition!)} to ${formatPosition(action.championDropPosition!)}, using dice value [${action.diceValueUsed}]. Champion arrived: ${tileDescription}.${reasoningText}`);
        await this.executeChampionArrivalAtTile(player, tile, championId!, action.championTileAction);
      } else if (boatMoveResult.championMoveResult === "championNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to move champion ${championId} at ${formatPosition(championStartPosition!)} but the champion was not reachable by this boat, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else if (boatMoveResult.championMoveResult === "targetPositionNotReachableByBoat") {
        this.addGameLogEntry("boat", `Boat ${action.boatId} moved from ${boatStartPosition} to ${boatMoveResult.endPosition} and tried to move champion ${championId} to ${formatPosition(action.championDropPosition!)} but that position was not reachable by this boat, using dice value [${action.diceValueUsed}].${reasoningText}`);
      } else {
        throw new Error(`Unknown boat move result: ${boatMoveResult.championMoveResult}`);
      }
    } else {
      // Boat is staying in place but still using a die
      this.addGameLogEntry("boat", `Boat ${action.boatId} stayed in position, using dice value [${action.diceValueUsed}].${reasoningText}`);

      // If there's a champion to pick up and drop off without moving the boat
      if (championId && action.championDropPosition) {
        const tile = this.gameState.updateChampionPosition(player.name, championId, action.championDropPosition);
        const tileDescription = stringifyTile(tile, this.gameState, player.name);
        this.addGameLogEntry("boat", `Champion ${championId} transported from ${formatPosition(championStartPosition!)} to ${formatPosition(action.championDropPosition)} without moving boat. Champion arrived: ${tileDescription}`);
        await this.executeChampionArrivalAtTile(player, tile, championId, action.championTileAction);
      }
    }
  }

  private async executeChampionArrivalAtTile(player: Player, tile: Tile, championId: number, tileAction: TileAction | undefined): Promise<void> {
    // Create logging wrappers that match the handler's expected signature
    const logFn = (type: string, content: string) => this.addGameLogEntry(type as GameLogEntryType, content);
    const thinkingLogger = (content: string) => this.addGameLogEntry("thinking", content);

    // Step 1: Handle exploration
    handleExploration(this.gameState, tile, player, logFn);

    // Step 2: Handle champion combat
    const getPlayerAgent = (playerName: string) => {
      const playerIndex = this.gameState.players.findIndex(p => p.name === playerName);
      return playerIndex >= 0 ? this.playerAgents[playerIndex] : undefined;
    };

    const championCombatResult = await handleChampionCombat(this.gameState, tile, player, championId, this.playerAgents[this.gameState.currentPlayerIndex], this.gameLog, logFn, thinkingLogger, getPlayerAgent);
    if (championCombatResult.combatOccurred && !championCombatResult.attackerWon) {
      // Attacker lost, defeat effects already applied by combat handler
      return;
    }

    // Step 3: Handle monster combat (but only if not from an adventure card)
    let adventureCardCombatOccurred = false;

    // Step 4: Handle special tiles (adventure/oasis) - moved before monster combat
    const specialTileResult = handleSpecialTiles(tile, championId, logFn);
    if (specialTileResult.interactionOccurred && specialTileResult.adventureCardDrawn) {
      // Draw and handle adventure card
      const adventureCard = this.gameDecks.drawCard(tile.tier!, 1);

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
          thinkingLogger
        );

        // Handle results from adventure card
        if (adventureResult.cardProcessed && adventureResult.monsterPlaced?.combatOccurred) {
          adventureCardCombatOccurred = true;

          if (adventureResult.monsterPlaced.championDefeated) {
            // Champion was defeated by a monster from the adventure card, defeat effects already applied by combat handler
            return;
          }
        }
      }
    }

    // Only handle existing monster combat if no adventure card combat occurred
    if (!adventureCardCombatOccurred) {
      const monsterCombatResult = await handleMonsterCombat(this.gameState, tile, player, championId, logFn);
      if (monsterCombatResult.combatOccurred && !monsterCombatResult.championWon) {
        // Champion lost to monster, defeat effects already applied by combat handler
        return;
      }
    }

    // Step 5: Handle Doomspire tile (dragon combat and victory conditions)
    const doomspireResult = await handleDoomspireTile(this.gameState, tile, player, championId, logFn);
    if (doomspireResult.entered) {
      if (doomspireResult.alternativeVictory) {
        this.endGame(doomspireResult.alternativeVictory.playerName, doomspireResult.alternativeVictory.type);
        return;
      }
      if (doomspireResult.dragonCombat) {
        if (doomspireResult.dragonCombat.combatVictory) {
          this.endGame(doomspireResult.dragonCombat.combatVictory.playerName, "Combat Victory");
          return;
        } else if (doomspireResult.dragonCombat.championDefeated) {
          // Champion defeated by dragon, defeat effects already applied by combat handler
          return;
        }
      }
    }

    // Step 6: Handle item pickup and drop
    if (tileAction?.pickUpItems || tileAction?.dropItems) {
      const { handleItemManagement } = await import("@/engine/handlers/tileArrivalHandler");
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


    // Step 7: Handle trader interactions
    if (tile.tileType === "trader" && tileAction?.useTrader) {
      await this.handleTraderVisit(player, championId, logFn);
    }

    // Step 8: Handle mercenary camp interactions
    if (tile.tileType === "mercenary" && tileAction?.useMercenary) {
      const { handleMercenaryAction } = await import("@/engine/handlers/tileArrivalHandler");
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

    // Step 9: Handle temple interactions
    if (tile.tileType === "temple" && tileAction?.useTemple) {
      const { handleTempleAction } = await import("@/engine/handlers/tileArrivalHandler");
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

    // Step 10: Handle tile claiming
    handleTileClaiming(this.gameState, tile, player, championId, !!tileAction?.claimTile, logFn);
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

  private async executeBuildAction(player: Player, action: BuildAction, reasoning?: string): Promise<void> {
    const reasoningText = reasoning ? ` Reason: ${reasoning}.` : "";

    if (action.buildingType === "blacksmith") {
      // Check if player can afford blacksmith: 2 Food + 2 Ore (according to rules)
      if (player.resources.food >= 2 && player.resources.ore >= 2) {
        // Check if player already has a blacksmith (max 1 per player)
        const hasBlacksmith = player.buildings.some(building => building.type === "blacksmith");

        if (hasBlacksmith) {
          this.addGameLogEntry("system", `Cannot build blacksmith - player already has one.${reasoningText}`);
          return;
        }

        // Deduct resources
        player.resources.food -= 2;
        player.resources.ore -= 2;

        // Add blacksmith to player's buildings
        player.buildings.push({
          type: "blacksmith"
        });

        this.addGameLogEntry(
          "system",
          `Built a blacksmith for 2 Food + 2 Ore, using die value [${action.diceValueUsed}].${reasoningText}`
        );
      } else {
        this.addGameLogEntry(
          "system",
          `Cannot afford blacksmith - requires 2 Food + 2 Ore.${reasoningText}`
        );
      }
    }
  }

  private async handleBuildingUsage(
    player: Player,
    playerAgent: PlayerAgent,
    thinkingLogger?: (content: string) => void
  ): Promise<void> {
    // Check if player has any usable buildings
    const hasBlacksmith = player.buildings.some(building => building.type === "blacksmith");

    if (!hasBlacksmith) {
      return; // No buildings to use
    }

    // Ask player which buildings to use
    const buildingUsageDecision = await playerAgent.useBuilding(this.gameState, this.gameLog, player.name, thinkingLogger);

    // Process blacksmith usage
    if (buildingUsageDecision.useBlacksmith) {
      const blacksmith = player.buildings.find(building => building.type === "blacksmith");

      if (blacksmith && player.resources.gold >= 1 && player.resources.ore >= 2) {
        // Deduct resources and gain might
        player.resources.gold -= 1;
        player.resources.ore -= 2;
        player.might += 1;

        this.addGameLogEntry(
          "system",
          `Used blacksmith to buy 1 Might for 1 Gold + 2 Ore.`
        );
      } else if (player.resources.gold < 1 || player.resources.ore < 2) {
        this.addGameLogEntry(
          "system",
          `Cannot use blacksmith - requires 1 Gold + 2 Ore.`
        );
      }
    }
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
