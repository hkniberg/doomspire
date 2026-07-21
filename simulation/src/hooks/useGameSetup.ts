import { useState, useCallback } from "react";
import { TemplateProcessor } from "@/lib/templateProcessor";
import { Claude, ClaudeModel, DEFAULT_CLAUDE_MODEL } from "@/llm/claude";
import { TokenUsageTracker } from "@/lib/TokenUsageTracker";
import { GameMaster, GameMasterConfig } from "../engine/GameMaster";
import { ClaudePlayerAgent } from "../players/ClaudePlayer";
import { HumanPlayer } from "../players/HumanPlayer";
import { PlayerAgent } from "../players/PlayerAgent";
import { RandomPlayerAgent } from "../players/RandomPlayerAgent";
import { DecisionContext, GameLogEntry, TurnContext } from "../lib/types";
import { DiceAction } from "../lib/actionTypes";
import { TraderContext, TraderDecision } from "../lib/traderTypes";
import { HarvestDecision } from "../lib/actionTypes";

type PlayerType = "random" | "claude" | "human";

interface PlayerConfig {
  name: string;
  type: PlayerType;
  model?: ClaudeModel; // Only relevant for claude players
}

interface GameConfig {
  startFame: number;
  startMight: number;
  startFood: number;
  startWood: number;
  startOre: number;
  startGold: number;
  seed: number;
  maxRounds: number;
}

interface UseGameSetupReturn {
  playerConfigs: PlayerConfig[];
  gameConfig: GameConfig;
  apiKey: string;
  showApiKeyModal: boolean;
  isStartingGame: boolean;
  errorMessage: string | null;
  setPlayerConfigs: (configs: PlayerConfig[]) => void;
  setGameConfig: (config: GameConfig) => void;
  setApiKey: (key: string) => void;
  setShowApiKeyModal: (show: boolean) => void;
  setIsStartingGame: (starting: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  updatePlayerConfig: (index: number, field: keyof PlayerConfig, value: string) => void;
  createPlayer: (
    config: PlayerConfig,
    tokenUsageTracker?: import("@/lib/TokenUsageTracker").TokenUsageTracker,
    humanPlayerCallbacks?: {
      onDiceActionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
      ) => Promise<DiceAction>;
      onDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
      ) => Promise<{ choice: string }>;
      onTraderDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
      ) => Promise<TraderDecision>;
      onHarvestDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
      ) => Promise<HarvestDecision>;
    },
  ) => Promise<PlayerAgent>;
  startNewGame: (
    setGameSession: (session: GameMaster) => void,
    setGameState: (state: import("../game/GameState").GameState) => void,
    setSimulationState: (state: "setup" | "playing" | "finished") => void,
    setActionLog: (log: any[]) => void,
    setStatistics: (stats: readonly import("../lib/types").TurnStatistics[]) => void,
    setCurrentView: (view: "game" | "statistics") => void,
    setAutoPlay: (autoPlay: boolean) => void,
    humanPlayerCallbacks?: {
      onDiceActionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
      ) => Promise<DiceAction>;
      onDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
      ) => Promise<{ choice: string }>;
      onTraderDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
      ) => Promise<TraderDecision>;
      onHarvestDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
      ) => Promise<HarvestDecision>;
    },
  ) => Promise<void>;
  hasClaudePlayers: boolean;
  // Per-player token usage trackers for Claude players, keyed by player name
  claudeTokenTrackers: Record<string, TokenUsageTracker>;
}

export function useGameSetup(): UseGameSetupReturn {
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([
    { name: "Alice", type: "human" },
    { name: "Bob", type: "random" },
    { name: "Charlie", type: "random" },
    { name: "Diana", type: "random" },
  ]);

  const [gameConfig, setGameConfig] = useState<GameConfig>({
    startFame: 0,
    startMight: 0,
    startFood: 0,
    startWood: 0,
    startOre: 0,
    startGold: 2,
    seed: 0,
    maxRounds: 30,
  });

  const [apiKey, setApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claudeTokenTrackers, setClaudeTokenTrackers] = useState<Record<string, TokenUsageTracker>>({});

  const updatePlayerConfig = useCallback((index: number, field: keyof PlayerConfig, value: string) => {
    setPlayerConfigs((prev) => prev.map((config, i) => (i === index ? { ...config, [field]: value } : config)));
  }, []);

  const createPlayer = useCallback(async (
    config: PlayerConfig,
    tokenUsageTracker?: import("@/lib/TokenUsageTracker").TokenUsageTracker,
    humanPlayerCallbacks?: {
      onDiceActionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
      ) => Promise<DiceAction>;
      onDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
      ) => Promise<{ choice: string }>;
      onTraderDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
      ) => Promise<TraderDecision>;
      onHarvestDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
      ) => Promise<HarvestDecision>;
    },
  ): Promise<PlayerAgent> => {
    switch (config.type) {
      case "random":
        return new RandomPlayerAgent(config.name);
      case "claude":
        if (!apiKey.trim()) {
          throw new Error("API key is required for Claude players");
        }
        // Create template processor for web usage (uses fetch)
        const templateProcessor = new TemplateProcessor();
        // Get the system message for Claude
        const systemMessage = await templateProcessor.processTemplate("SystemPrompt", {});
        const claude = new Claude(apiKey.trim(), systemMessage, config.model ?? DEFAULT_CLAUDE_MODEL, tokenUsageTracker);
        return new ClaudePlayerAgent(config.name, claude, templateProcessor);
      case "human":
        const humanPlayer = new HumanPlayer(config.name);
        if (humanPlayerCallbacks) {
          humanPlayer.setCallbacks(humanPlayerCallbacks);
        }
        return humanPlayer;
      default:
        throw new Error(`Unknown player type: ${config.type}`);
    }
  }, [apiKey]);

  const startNewGame = useCallback(async (
    setGameSession: (session: GameMaster) => void,
    setGameState: (state: import("../game/GameState").GameState) => void,
    setSimulationState: (state: "setup" | "playing" | "finished") => void,
    setActionLog: (log: any[]) => void,
    setStatistics: (stats: readonly import("../lib/types").TurnStatistics[]) => void,
    setCurrentView: (view: "game" | "statistics") => void,
    setAutoPlay: (autoPlay: boolean) => void,
    humanPlayerCallbacks?: {
      onDiceActionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
      ) => Promise<DiceAction>;
      onDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
      ) => Promise<{ choice: string }>;
      onTraderDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
      ) => Promise<TraderDecision>;
      onHarvestDecisionNeeded: (
        gameState: import("../game/GameState").GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
      ) => Promise<HarvestDecision>;
    },
  ) => {
    try {
      // Check if Claude players need API key
      const hasClaudePlayers = playerConfigs.some((config) => config.type === "claude");
      if (hasClaudePlayers && !apiKey.trim()) {
        setShowApiKeyModal(true);
        return;
      }

      setIsStartingGame(true);

      // Create one token usage tracker per Claude player, so cost can be shown
      // per player (and priced per model)
      const trackers: Record<string, TokenUsageTracker> = {};
      for (const config of playerConfigs) {
        if (config.type === "claude") {
          trackers[config.name] = new TokenUsageTracker(config.model ?? DEFAULT_CLAUDE_MODEL);
        }
      }
      setClaudeTokenTrackers(trackers);

      // Create all players asynchronously
      const players = await Promise.all(
        playerConfigs.map((config) => createPlayer(config, trackers[config.name], humanPlayerCallbacks))
      );

      // Validate player names
      const playerNames = players.map((p) => p.getName());
      if (new Set(playerNames).size !== playerNames.length) {
        setErrorMessage("Player names must be unique");
        return;
      }

      // Validate player types
      const hasValidTypes = players.every((p) => ["random", "claude", "human"].includes(p.getType()));
      if (!hasValidTypes) {
        setErrorMessage("Invalid player type detected");
        return;
      }

      // Create game session
      const sessionConfig: GameMasterConfig = {
        players: players,
        maxRounds: gameConfig.maxRounds,
        startingValues: {
          fame: gameConfig.startFame,
          might: gameConfig.startMight,
          food: gameConfig.startFood,
          wood: gameConfig.startWood,
          ore: gameConfig.startOre,
          gold: gameConfig.startGold,
        },
        seed: gameConfig.seed,
      };

      const session = new GameMaster(sessionConfig);
      session.start();

      setGameSession(session);
      setGameState(session.getGameState());
      setSimulationState("playing");
      setActionLog([]);
      setStatistics([]);
      setCurrentView("game");
      setAutoPlay(false);

      console.log(
        "New game started with players:",
        players.map((p) => `${p.getName()} (${p.getType()})`),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to start game: ${errorMessage}`);
    } finally {
      setIsStartingGame(false);
    }
  }, [playerConfigs, apiKey, gameConfig, createPlayer]);

  const hasClaudePlayers = playerConfigs.some((config) => config.type === "claude");

  return {
    playerConfigs,
    gameConfig,
    apiKey,
    showApiKeyModal,
    isStartingGame,
    errorMessage,
    setPlayerConfigs,
    setGameConfig,
    setApiKey,
    setShowApiKeyModal,
    setIsStartingGame,
    setErrorMessage,
    updatePlayerConfig,
    createPlayer,
    startNewGame,
    hasClaudePlayers,
    claudeTokenTrackers,
  };
}
