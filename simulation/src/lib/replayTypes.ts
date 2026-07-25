// Lords of Doomspire Match Recording Types
//
// A match recording is a series of game state snapshots (captured at every step of the
// game) plus the full game log and statistics. Since the simulator uses unseeded
// randomness and non-deterministic AI decisions, matches cannot be replayed by
// re-running the engine - replay works by rendering these stored snapshots.

import type { FateCard } from "../content/fateCards";
import type { FateEffects, GameLogEntry, GamePhase, Player, Tile, TurnStatistics } from "./types";

/**
 * Serialized form of a GameState (the shape produced by GameState.toJSON
 * and consumed by GameState.fromJSON).
 */
export interface GameStateData {
  board: Tile[][];
  players: Player[];
  currentPlayerIndex: number;
  startPlayerIndex: number;
  currentRound: number;
  gameEnded: boolean;
  winner?: number;
  fateEffects: FateEffects;
  doubleFoodTaxNextRound?: boolean;
}

/**
 * One point-in-time snapshot of the match, captured after each game step
 * (fate resolution, dice roll, strategic assessment, each dice action, each
 * player's harvest, game end).
 */
export interface MatchSnapshot {
  /** Deep-cloned game state at this point in time */
  gameState: GameStateData;
  /** Number of game log entries that existed when this snapshot was taken */
  logLength: number;
  phase: GamePhase;
  /** The fate card in effect at this point (null before the first fate card is drawn) */
  currentFateCard: FateCard | null;
  /** Short human-readable label, e.g. "Round 3 - Move - Alice" */
  label: string;
}

/**
 * A complete recorded match: metadata, all snapshots, the full game log
 * (including AI thinking and assessments), and per-round statistics.
 */
export interface MatchRecording {
  version: 1;
  savedAt: string; // ISO timestamp
  playerNames: string[];
  playerTypes: string[];
  seed?: number;
  maxRounds?: number;
  snapshots: MatchSnapshot[];
  gameLog: GameLogEntry[];
  statistics: TurnStatistics[];
}
