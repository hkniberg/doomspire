// Lords of Doomspire Game State Model

import { getCoastalTilesForOceanPosition } from "../engine/actions/moveCalculator";
import { Board } from "../lib/Board";
import { BoardBuilder } from "../lib/BoardBuilder";
import { GameSettings } from "../lib/GameSettings";
import type { Boat, Champion, OceanPosition, Player, Position, Tile } from "../lib/types";

export class GameState {

  public board: Board;
  public players: Player[];
  public currentPlayerIndex: number;
  public startPlayerIndex: number; // Tracks which player starts each round
  public currentRound: number;
  public gameEnded: boolean;
  public winner?: number;

  constructor(
    board: Board,
    players: Player[],
    currentPlayerIndex: number = 0,
    currentRound: number = 1,
    gameEnded: boolean = false,
    winner?: number,
    startPlayerIndex: number = 0, // Default first player starts
  ) {
    this.board = board;
    this.players = players;
    this.currentPlayerIndex = currentPlayerIndex;
    this.startPlayerIndex = startPlayerIndex;
    this.currentRound = currentRound;
    this.gameEnded = gameEnded;
    this.winner = winner;
  }

  /**
   * Create a new GameState with the specified player names
   */
  public static createWithPlayerNames(
    playerNames: string[],
    startingValues?: { fame?: number; might?: number; food?: number; wood?: number; ore?: number; gold?: number },
    seed?: number,
  ): GameState {
    if (playerNames.length !== 4) {
      throw new Error(`Expected 4 player names, got ${playerNames.length}`);
    }

    const board = BoardBuilder.buildBoard(seed || 0);
    const players = GameState.initializePlayersWithNames(playerNames, startingValues);

    // Create the initial game state
    const gameState = new GameState(board, players);

    // Claim home tiles for each player (according to game rules)
    gameState.claimHomeTilesForPlayers();

    return gameState;
  }

  private static initializePlayersWithNames(
    playerNames: string[],
    startingValues?: { fame?: number; might?: number; food?: number; wood?: number; ore?: number; gold?: number },
  ): Player[] {
    const players: Player[] = [];
    const startingPositions: Position[] = [
      { row: 0, col: 0 }, // Player 1
      { row: 0, col: 7 }, // Player 2
      { row: 7, col: 0 }, // Player 3
      { row: 7, col: 7 }, // Player 4
    ];
    const oceanPositions = ["nw", "ne", "sw", "se"] as const;

    // Predefined player colors - matches the UI color scheme
    const playerColors = [
      "#e74c3c", // Red
      "#3498db", // Blue
      "#2ecc71", // Green
      "#f39c12", // Orange
    ];

    const startingFame = startingValues?.fame ?? 0;
    const startingMight = startingValues?.might ?? 0;
    const startingFood = startingValues?.food ?? 0;
    const startingWood = startingValues?.wood ?? 0;
    const startingOre = startingValues?.ore ?? 0;
    const startingGold = startingValues?.gold ?? 2;

    for (let i = 0; i < 4; i++) {
      const playerName = playerNames[i];
      const champion: Champion = {
        id: 1,
        position: startingPositions[i],
        playerName: playerName,
        items: [],
        followers: [],
      };

      const boat: Boat = {
        id: 1,
        playerName: playerName,
        position: oceanPositions[i],
      };

      players.push({
        name: playerNames[i],
        color: playerColors[i],
        fame: startingFame,
        might: startingMight,
        resources: {
          food: startingFood,
          wood: startingWood,
          ore: startingOre,
          gold: startingGold
        },
        maxClaims: 10,
        champions: [champion],
        boats: [boat],
        buildings: [], // Initialize with no buildings
        homePosition: startingPositions[i],
        extraInstructions: "", // Initialize with empty extra instructions
        statistics: { // Initialize statistics counters
          championVsChampionWins: 0,
          championVsChampionLosses: 0,
          championVsMonsterWins: 0,
          championVsMonsterLosses: 0,
          dragonEncounters: 0,
          marketInteractions: 0,
          blacksmithInteractions: 0,
          fletcherInteractions: 0,
          traderInteractions: 0,
          templeInteractions: 0,
          mercenaryInteractions: 0,
          championActions: 0,
          boatActions: 0,
          harvestActions: 0,
          buildActions: 0,
          adventureCards: 0,
        },
      });
    }

    return players;
  }

  /**
   * Claim home tiles for each player according to game rules
   * Home tiles are automatically claimed by players from the start of the game
   */
  private claimHomeTilesForPlayers(): void {
    for (const player of this.players) {
      const homeTile = this.getTile(player.homePosition);
      if (homeTile && homeTile.tileType === "home") {
        homeTile.claimedBy = player.name;
      }
    }
  }

  public getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  public getStartingPlayer(): Player {
    return this.players[this.startPlayerIndex];
  }

  public getPlayer(playerName: string): Player | undefined {
    return this.players.find((p) => p.name === playerName);
  }

  public getTile(position: Position): Tile | undefined {
    return this.board.getTileAt(position) || undefined;
  }

  public getChampion(playerName: string, championId: number): Champion | undefined {
    const player = this.getPlayer(playerName);
    if (!player) {
      return undefined;
    }
    return player?.champions.find((c) => c.id === championId);
  }

  public getOpposingChampionsAtPosition(playerName: string, position: Position): Champion[] {
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      throw new Error(`Player ${playerName} not found`);
    }

    const opposingChampions: Champion[] = [];

    // Iterate through all players
    for (const otherPlayer of this.players) {
      // Skip the current player
      if (otherPlayer.name === playerName) {
        continue;
      }

      // Check all champions of this other player
      for (const champion of otherPlayer.champions) {
        // If champion is at the specified position, add to result
        if (champion.position.row === position.row && champion.position.col === position.col) {
          opposingChampions.push(champion);
        }
      }
    }

    return opposingChampions;
  }

  public getStarredTileCount(playerName: string): number {
    const starredTileCount = this.board.findTiles(
      (tile) => tile.tileType === "resource" && tile.isStarred === true && tile.claimedBy === playerName,
    ).length;
    return starredTileCount;
  }

  /**
   * Advances to the next player's turn
   * When all players have had their turn in a round, advances the starting player token
   */
  public advanceToNextPlayer(): GameState {
    const nextPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // Check if completing this round (next player would be the current round's starting player)
    const isRoundComplete = nextPlayerIndex === this.startPlayerIndex;

    if (isRoundComplete) {
      // Round is complete - advance the starting player token and start new round
      this.startPlayerIndex = (this.startPlayerIndex + 1) % this.players.length;
      this.currentPlayerIndex = this.startPlayerIndex;
      this.currentRound = this.currentRound + 1;
    } else {
      // Continue with next player in current round
      this.currentPlayerIndex = nextPlayerIndex;
    }

    return this;
  }

  public updateChampionPosition(playerName: string, championId: number, endPosition: Position): Tile {
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      throw new Error(`Player ${playerName} not found`);
    }
    const champion = player.champions.find((c) => c.id === championId);
    if (!champion) {
      throw new Error(`Champion ${championId} not found for player ${playerName}`);
    }
    const tile = this.getTile(endPosition);
    if (!tile) {
      throw new Error(`Tile at (${endPosition.row}, ${endPosition.col}) does not exist`);
    }

    champion.position = endPosition;
    return tile;
  }

  public moveChampionToHome(playerName: string, championId: number) {
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      throw new Error(`Player ${playerName} not found`);
    }
    const champion = player.champions.find((c) => c.id === championId);
    if (!champion) {
      throw new Error(`Champion ${championId} not found for player ${playerName}`);
    }
    champion.position = player.homePosition;
  }

  public getClaimedTiles(playerName: string): Tile[] {
    const claimedTiles: Tile[] = [];
    for (const row of this.board.getTilesGrid()) {
      for (const tile of row) {
        if (tile.claimedBy === playerName) {
          claimedTiles.push(tile);
        }
      }
    }
    return claimedTiles;
  }

  public toJSON() {
    return {
      board: this.board.getTilesGrid(),
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      startPlayerIndex: this.startPlayerIndex,
      currentRound: this.currentRound,
      gameEnded: this.gameEnded,
      winner: this.winner,
    };
  }

  /**
   * Returns a filtered version of the game state for AI consumption.
   * Unexplored tiles only show position, tier, and explored: false.
   */
  public toAIJSON() {
    const filteredBoard: Tile[][] = [];

    // Reconstruct 2D array structure for backwards compatibility
    for (let row = 0; row < 8; row++) {
      filteredBoard[row] = [];
      for (let col = 0; col < 8; col++) {
        const tile = this.board.getTileAt({ row, col });
        if (!tile) continue;

        if (!tile.explored) {
          // For unexplored tiles, only show position, tier, and explored status
          filteredBoard[row][col] = {
            position: tile.position,
            tier: tile.tier,
            explored: false,
            // Note: intentionally omitting adventureTokens, resources, monster, etc.
          } as Tile;
        } else {
          // For explored tiles, show all information
          filteredBoard[row][col] = tile;
        }
      }
    }

    return {
      board: filteredBoard,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      startPlayerIndex: this.startPlayerIndex,
      currentRound: this.currentRound,
      gameEnded: this.gameEnded,
      winner: this.winner,
    };
  }

  /**
   * Get the combat support bonus from adjacent units (knights and warships) for a player at a given position
   * This implements the combat support rules where your own units provide +2 might per supporting unit
   */
  public getCombatSupport(playerName: string, combatPosition: Position): number {
    let supportCount = 0;

    // Find all adjacent positions
    const adjacentPositions = this.getAdjacentPositions(combatPosition);

    // Check for supporting knights in adjacent tiles
    for (const adjacentPos of adjacentPositions) {
      const adjacentTile = this.getTile(adjacentPos);
      if (adjacentTile) {
        // Find champions of the same player in adjacent tiles
        const supportingChampions = this.getChampionsAtPosition(playerName, adjacentPos);
        supportCount += supportingChampions.length;
      }
    }

    // Check for supporting warships in adjacent ocean zones
    const player = this.getPlayer(playerName);
    if (player) {
      for (const boat of player.boats) {
        if (this.isWarship(player) && this.isBoatAdjacentToPosition(boat.position, combatPosition)) {
          supportCount += 1;
        }
      }
    }

    // A given player can provide at most one support per battle,
    // no matter how many knights or warships they have in range
    return Math.min(supportCount, 1) * GameSettings.COMBAT_SUPPORT_BONUS;
  }

  /**
   * Get all adjacent positions to a given position (horizontally and vertically only)
   */
  private getAdjacentPositions(position: Position): Position[] {
    const adjacent: Position[] = [];
    const { row, col } = position;

    // Check all four directions: up, down, left, right
    const directions = [
      { row: row - 1, col: col }, // up
      { row: row + 1, col: col }, // down
      { row: row, col: col - 1 }, // left
      { row: row, col: col + 1 }, // right
    ];

    for (const dir of directions) {
      if (dir.row >= 0 && dir.row < 8 && dir.col >= 0 && dir.col < 8) {
        adjacent.push(dir);
      }
    }

    return adjacent;
  }

  /**
   * Get all champions of a specific player at a given position
   */
  private getChampionsAtPosition(playerName: string, position: Position): Champion[] {
    const player = this.getPlayer(playerName);
    if (!player) return [];

    return player.champions.filter(champion =>
      champion.position.row === position.row && champion.position.col === position.col
    );
  }

  /**
   * Check if a player has the warship upgrade
   */
  private isWarship(player: Player): boolean {
    return player.buildings.includes("warshipUpgrade");
  }

  /**
   * Check if a boat's ocean position is adjacent to a given tile position
   * Warships provide +1 might to battles in tiles adjacent to their ocean zone
   */
  private isBoatAdjacentToPosition(boatPosition: OceanPosition, tilePosition: Position): boolean {
    const adjacentTiles = getCoastalTilesForOceanPosition(boatPosition);
    return adjacentTiles.some(pos =>
      pos.row === tilePosition.row && pos.col === tilePosition.col
    );
  }

  /**
   * Check if a claimed tile is protected from blockade or conquest
   * A tile is protected if the owner has knights in the tile or adjacent tiles
   */
  public isClaimProtected(tile: Tile): boolean {
    // Only claimed tiles can be protected
    if (!tile.claimedBy) {
      return false;
    }

    const tileOwner = this.getPlayer(tile.claimedBy);
    if (!tileOwner) {
      return false;
    }

    // Check for knight protection (in the tile itself)
    const ownerChampionsInTile = tileOwner.champions.filter(champion =>
      champion.position.row === tile.position.row && champion.position.col === tile.position.col
    );

    if (ownerChampionsInTile.length > 0) {
      return true;
    }

    // Check for knight protection (adjacent tiles)
    const adjacentPositions = this.getAdjacentPositions(tile.position);

    for (const adjacentPos of adjacentPositions) {
      const adjacentTile = this.getTile(adjacentPos);
      if (!adjacentTile) continue;

      // Check if the tile owner has a knight in this adjacent position
      const ownerChampionsAtPosition = tileOwner.champions.filter(champion =>
        champion.position.row === adjacentPos.row && champion.position.col === adjacentPos.col
      );

      if (ownerChampionsAtPosition.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a claimed tile is being blockaded and return the blockading player's name
   * According to game rules: "A knight that is in another player's resource tile will blockade it"
   * A tile can only be blockaded if it's not protected by adjacent knights
   */
  public getClaimBlockader(tile: Tile): string | null {
    // Only claimed resource tiles can be blockaded
    if (!tile.claimedBy || tile.tileType !== "resource") {
      return null;
    }

    // A tile cannot be blockaded if it's protected
    if (this.isClaimProtected(tile)) {
      return null;
    }

    // Check if any opposing player has a champion on this tile
    for (const player of this.players) {
      if (player.name === tile.claimedBy) {
        continue; // Skip the tile owner
      }

      // Check if this player has a champion on the tile
      for (const champion of player.champions) {
        if (champion.position.row === tile.position.row && champion.position.col === tile.position.col) {
          return player.name; // This player is blockading the tile
        }
      }
    }

    return null; // No blockade
  }

  /**
   * Get all coastal tile positions for a given ocean zone
   */
  public getCoastalTilesForOceanZone(oceanPosition: OceanPosition): Position[] {
    switch (oceanPosition) {
      case "nw":
        return [
          { row: 3, col: 0 }, { row: 2, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 0 },
          { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }
        ];
      case "ne":
        return [
          { row: 0, col: 4 }, { row: 0, col: 5 }, { row: 0, col: 6 }, { row: 0, col: 7 },
          { row: 1, col: 7 }, { row: 2, col: 7 }, { row: 3, col: 7 }
        ];
      case "se":
        return [
          { row: 4, col: 7 }, { row: 5, col: 7 }, { row: 6, col: 7 }, { row: 7, col: 7 },
          { row: 7, col: 6 }, { row: 7, col: 5 }, { row: 7, col: 4 }
        ];
      case "sw":
        return [
          { row: 7, col: 3 }, { row: 7, col: 2 }, { row: 7, col: 1 }, { row: 7, col: 0 },
          { row: 6, col: 0 }, { row: 5, col: 0 }, { row: 4, col: 0 }
        ];
    }
  }

  /**
   * Get neighboring ocean zones for a given ocean position
   * Ocean zones form a ring: nw-ne-se-sw-nw
   */
  public getNeighboringOceanZones(oceanPosition: OceanPosition): OceanPosition[] {
    switch (oceanPosition) {
      case "nw":
        return ["ne", "sw"];
      case "ne":
        return ["nw", "se"];
      case "se":
        return ["ne", "sw"];
      case "sw":
        return ["se", "nw"];
    }
  }

  /**
   * Find all champions of a player that are in coastal tiles of a given ocean zone
   */
  public getChampionsInCoastalTiles(playerName: string, oceanPosition: OceanPosition): Champion[] {
    const player = this.getPlayer(playerName);
    if (!player) return [];

    const coastalTiles = this.getCoastalTilesForOceanZone(oceanPosition);
    const championsInCoast: Champion[] = [];

    for (const champion of player.champions) {
      for (const coastalPos of coastalTiles) {
        if (champion.position.row === coastalPos.row && champion.position.col === coastalPos.col) {
          championsInCoast.push(champion);
          break; // Champion found, no need to check other coastal positions
        }
      }
    }

    return championsInCoast;
  }
}
