import { useState, useRef, useEffect, useCallback } from "react";
import { GameMaster, GameMasterConfig } from "../engine/GameMaster";
import { GameState } from "../game/GameState";
import { MatchRecording, MatchSnapshot } from "../lib/replayTypes";
import { TurnStatistics } from "../lib/types";

// "replay" = viewing a loaded match recording (no live GameMaster)
type SimulationState = "setup" | "playing" | "finished" | "replay";

interface UseGameSessionReturn {
  gameSession: GameMaster | null;
  gameState: GameState | null;
  simulationState: SimulationState;
  actionLog: any[];
  statistics: readonly TurnStatistics[];
  snapshots: readonly MatchSnapshot[];
  replayIndex: number | null;
  isExecutingTurn: boolean;
  autoPlay: boolean;
  autoPlaySpeed: number;
  setGameSession: (session: GameMaster | null) => void;
  setGameState: (state: GameState | null) => void;
  setSimulationState: (state: SimulationState) => void;
  setActionLog: (log: any[]) => void;
  setStatistics: (stats: readonly TurnStatistics[]) => void;
  setSnapshots: (snapshots: readonly MatchSnapshot[]) => void;
  setReplayIndex: (index: number | null) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  setAutoPlaySpeed: (speed: number) => void;
  executeNextTurn: () => Promise<void>;
  loadRecording: (recording: MatchRecording) => void;
  resetGame: () => void;
}

export function useGameSession(): UseGameSessionReturn {
  const [gameSession, setGameSession] = useState<GameMaster | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [simulationState, setSimulationState] = useState<SimulationState>("setup");
  const [actionLog, setActionLog] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<readonly TurnStatistics[]>([]);
  const [snapshots, setSnapshots] = useState<readonly MatchSnapshot[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isExecutingTurn, setIsExecutingTurn] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000);

  // Ref to hold the autoplay timeout
  const autoPlayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always get current autoPlay state (avoids closure issues)
  const autoPlayRef = useRef(autoPlay);

  // Keep autoPlayRef in sync with autoPlay state
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  const executeNextTurn = useCallback(async () => {
    if (!gameSession || simulationState !== "playing" || isExecutingTurn) {
      return;
    }

    setIsExecutingTurn(true);

    try {
      // Create callback for step updates during turn execution
      const onStepUpdate = () => {
        const updatedGameState = gameSession.getGameState();
        const updatedGameLog = gameSession.getGameLog();
        const updatedStatistics = gameSession.getStatistics();

        setGameState(updatedGameState);
        setActionLog(Array.from(updatedGameLog));
        setStatistics(updatedStatistics);
        setSnapshots(Array.from(gameSession.getSnapshots()));
      };

      // Execute turn with step update callback
      await gameSession.executeTurn(onStepUpdate);

      // Final update after turn completion
      const updatedGameState = gameSession.getGameState();
      const updatedGameLog = gameSession.getGameLog();
      const updatedStatistics = gameSession.getStatistics();

      setGameState(updatedGameState);
      setActionLog(Array.from(updatedGameLog));
      setStatistics(updatedStatistics);
      setSnapshots(Array.from(gameSession.getSnapshots()));

      // Check if game is finished
      if (gameSession.getMasterState() === "finished") {
        setSimulationState("finished");
        setAutoPlay(false);
        console.log("Game finished!");
      }
    } catch (error) {
      console.error("Error executing turn:", error);
      setAutoPlay(false);
    } finally {
      setIsExecutingTurn(false);

      // Schedule next autoplay turn if still enabled and game is still playing
      // Use ref to get current autoPlay state (avoids closure issues)
      if (autoPlayRef.current && simulationState === "playing" && gameSession?.getMasterState() !== "finished") {
        autoPlayTimeout.current = setTimeout(() => {
          executeNextTurn();
        }, autoPlaySpeed);
      }
    }
  }, [gameSession, simulationState, isExecutingTurn, autoPlaySpeed]);

  const resetGame = useCallback(() => {
    setGameSession(null);
    setGameState(null);
    setSimulationState("setup");
    setActionLog([]);
    setStatistics([]);
    setSnapshots([]);
    setReplayIndex(null);
    setAutoPlay(false);
  }, []);

  // Load a saved match recording for viewer-only replay (no live GameMaster)
  const loadRecording = useCallback((recording: MatchRecording) => {
    setGameSession(null);
    setGameState(null);
    setActionLog(Array.from(recording.gameLog));
    setStatistics(recording.statistics);
    setSnapshots(recording.snapshots);
    setReplayIndex(recording.snapshots.length - 1);
    setSimulationState("replay");
    setAutoPlay(false);
  }, []);

  // Autoplay effect - starts initial autoplay and cleans up on changes
  useEffect(() => {
    // Clear any existing timeout when autoplay settings change
    if (autoPlayTimeout.current) {
      clearTimeout(autoPlayTimeout.current);
      autoPlayTimeout.current = null;
    }

    // Start initial autoplay turn if enabled and ready
    if (autoPlayRef.current && simulationState === "playing" && !isExecutingTurn) {
      autoPlayTimeout.current = setTimeout(() => {
        executeNextTurn();
      }, autoPlaySpeed);
    }

    // Cleanup function
    return () => {
      if (autoPlayTimeout.current) {
        clearTimeout(autoPlayTimeout.current);
        autoPlayTimeout.current = null;
      }
    };
  }, [autoPlay, simulationState, autoPlaySpeed, executeNextTurn]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoPlayTimeout.current) {
        clearTimeout(autoPlayTimeout.current);
        autoPlayTimeout.current = null;
      }
    };
  }, []);

  return {
    gameSession,
    gameState,
    simulationState,
    actionLog,
    statistics,
    snapshots,
    replayIndex,
    isExecutingTurn,
    autoPlay,
    autoPlaySpeed,
    setGameSession,
    setGameState,
    setSimulationState,
    setActionLog,
    setStatistics,
    setSnapshots,
    setReplayIndex,
    setAutoPlay,
    setAutoPlaySpeed,
    executeNextTurn,
    loadRecording,
    resetGame,
  };
}
