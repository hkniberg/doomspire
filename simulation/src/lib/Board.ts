import { Position, Tile, Bounds, ReachablePosition } from "./types";
import { getReachablePositions } from "./PathUtils";

export class Board {
  private tiles: Tile[][];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = this.initializeEmptyBoard();
  }

  private initializeEmptyBoard(): Tile[][] {
    const board: Tile[][] = [];
    for (let row = 0; row < this.height; row++) {
      board[row] = [];
      for (let col = 0; col < this.width; col++) {
        // Create empty tiles with default values
        board[row][col] = {
          position: { row, col },
          tileType: "empty",
        };
      }
    }
    return board;
  }

  /**
   * Set a tile at a specific position (replaces existing tile)
   */
  setTile(tile: Tile): void {
    const { row, col } = tile.position;
    if (this.isValidPosition({ row, col })) {
      this.tiles[row][col] = tile;
    } else {
      throw new Error(`Invalid position: (${row}, ${col}). Board size is ${this.height}x${this.width}`);
    }
  }

  /**
   * Get all tiles as a flat array
   */
  getAllTiles(): Tile[] {
    const allTiles: Tile[] = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        allTiles.push(this.tiles[row][col]);
      }
    }
    return allTiles;
  }

  /**
   * Get a tile at a specific position
   */
  getTileAt(position: Position): Tile | undefined {
    const { row, col } = position;
    if (this.isValidPosition(position)) {
      return this.tiles[row][col];
    }
    return undefined;
  }

  /**
   * Check if a position is valid for this board
   */
  private isValidPosition(position: Position): boolean {
    const { row, col } = position;
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  /**
   * Get the board dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get the 2D tiles array (for advanced use cases)
   */
  getTilesGrid(): Tile[][] {
    return this.tiles;
  }

  /**
   * Find tiles that match a predicate
   */
  findTiles(predicate: (tile: Tile) => boolean): Tile[] {
    return this.getAllTiles().filter(predicate);
  }

  /**
   * Execute a function for each tile with position information
   */
  forEachTile(callback: (tile: Tile, position: Position) => void): void {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const position = { row, col };
        const tile = this.tiles[row][col];
        callback(tile, position);
      }
    }
  }

  /**
   * Get all positions reachable within maxSteps from startPos within board bounds
   */
  getReachablePositions(startPos: Position, maxSteps: number): ReachablePosition[] {
    const bounds: Bounds = {
      minRow: 0,
      maxRow: this.height - 1,
      minCol: 0,
      maxCol: this.width - 1
    };

    return getReachablePositions(startPos, maxSteps, bounds);
  }

}
