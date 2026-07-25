import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ApiKeyModal } from "../components/ApiKeyModal";
import { CardDecks } from "../components/CardDecks";
import { ControlPanel } from "../components/ControlPanel";
import { FateCardPanel } from "../components/FateCardPanel";
import { GameBoard } from "../components/GameBoard";
import { GameLog } from "../components/GameLog";
import { GameStatus } from "../components/GameStatus";
import DicePanel from "../components/DicePanel";
import { HumanPlayerModal } from "../components/HumanPlayerModal";
import HumanPlayerStatus from "../components/HumanPlayerStatus";
import { ReplayControls } from "../components/ReplayControls";
import { TraderModal } from "../components/TraderModal";
import { BuildingModal } from "../components/BuildingModal";
import { PlayerConfigurationPanel } from "../components/PlayerConfigurationPanel";
import { SettingsMenu } from "../components/SettingsMenu";
import { StatisticsView } from "../components/StatisticsView";
import { TileActionModal } from "../components/TileActionModal";
import { TokenUsage } from "../components/TokenUsage";
import { GameState } from "../game/GameState";
import { stringifyGameState } from "../game/gameStateStringifier";
import { useGameSession } from "../hooks/useGameSession";
import { useGameSetup } from "../hooks/useGameSetup";
import { useHumanPlayer } from "../hooks/useHumanPlayer";
import { useMovementAndDice } from "../hooks/useMovementAndDice";
import { useTraderModal } from "../hooks/useTraderModal";
import { useBuildingModal } from "../hooks/useBuildingModal";
import { downloadRecording, readRecordingFromFile } from "../lib/matchRecordingIO";

// Simple spinner for loading states (used only in main component now)
const Spinner = ({ size = 20 }: { size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      border: `2px solid #f3f3f3`,
      borderTop: `2px solid #3498db`,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      marginRight: "8px",
    }}
  />
);

// Add keyframes for spinner animation
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

type ViewType = "game" | "statistics";

export default function GameSimulation() {
  // Client-side rendering state
  const [mounted, setMounted] = useState(false);

  // View state
  const [currentView, setCurrentView] = useState<ViewType>("game");
  const [showActionLog, setShowActionLog] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [allowDragging, setAllowDragging] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [copyGamestateSuccess, setCopyGamestateSuccess] = useState(false);

  // Use custom hooks
  const gameSession = useGameSession();
  const gameSetup = useGameSetup();
  const humanPlayer = useHumanPlayer();
  const movementAndDice = useMovementAndDice();
  const traderModal = useTraderModal();
  const buildingModal = useBuildingModal();

  // Replay state: when replayIndex is set (or a recording is loaded), the board,
  // status, fate card, and log render from the selected snapshot instead of the live state
  const { snapshots, replayIndex } = gameSession;
  const replaySnapshot = useMemo(() => {
    if (replayIndex === null || snapshots.length === 0) {
      return null;
    }
    return snapshots[Math.max(0, Math.min(replayIndex, snapshots.length - 1))];
  }, [replayIndex, snapshots]);

  const replayGameState = useMemo(
    () => (replaySnapshot ? GameState.fromJSON(replaySnapshot.gameState) : null),
    [replaySnapshot],
  );

  const isReplaying = replayGameState !== null;
  const displayedGameState = replayGameState ?? gameSession.gameState;
  const displayedGameLog = replaySnapshot
    ? gameSession.actionLog.slice(0, replaySnapshot.logLength)
    : gameSession.actionLog;
  const displayedFateCard = replaySnapshot
    ? replaySnapshot.currentFateCard
    : (gameSession.gameSession?.getCurrentFateCard() ?? null);

  // Initialize component only on client side
  useEffect(() => {
    setMounted(true);
    // Load API key from localStorage if available
    const storedKey = localStorage.getItem("anthropic-api-key");
    if (storedKey) {
      gameSetup.setApiKey(storedKey);
    }
  }, []);

  // Keyboard handler for WASD movement and harvest actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!humanPlayer.humanDiceActionContext || movementAndDice.selectedDieIndex === null) {
        return;
      }

      // Handle champion movement (WASD)
      if (movementAndDice.selectedChampionId !== null && movementAndDice.championMovementPath.length > 0) {
        switch (event.key.toLowerCase()) {
          case "w":
          case "s":
          case "a":
          case "d":
            event.preventDefault();
            movementAndDice.handleWASDMovement(event.key, gameSession.gameState || undefined);
            break;
          case "enter":
            // Complete the movement (like Done button)
            event.preventDefault();
            console.log("⏎ Enter pressed - completing movement");
            const resolver = humanPlayer.humanDiceActionContext?.resolver;
            const onAllDiceUsed = () => {
              humanPlayer.setHumanDiceActionContext(null);
            };
            movementAndDice.handleMovementDone(gameSession.gameState || undefined, resolver, onAllDiceUsed);
            break;
          case "escape":
            // Cancel the entire movement and deselect champion
            event.preventDefault();
            console.log("⎋ Escape pressed - canceling entire movement");
            movementAndDice.handleMovementCancel();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    movementAndDice.selectedChampionId,
    humanPlayer.humanDiceActionContext,
    movementAndDice.championMovementPath,
    movementAndDice.selectedDieIndex,
    movementAndDice,
    gameSession.gameState,
  ]);

  // Enhanced human player handlers with dice state management
  const enhancedHumanDiceAction = async (
    gameState: import("../game/GameState").GameState,
    gameLog: readonly import("../lib/types").GameLogEntry[],
    turnContext: import("../lib/types").TurnContext,
  ) => {
    // Only initialize dice state if this is the first action of the turn
    const isFirstActionOfTurn = turnContext.remainingDiceValues.length === turnContext.diceRolled.length;

    console.log("🎲 enhancedHumanDiceAction called:", {
      isFirstActionOfTurn,
      diceRolled: turnContext.diceRolled,
      remainingDiceValues: turnContext.remainingDiceValues,
      currentDiceValues: movementAndDice.diceValues,
      usedDiceIndices: movementAndDice.usedDiceIndices,
    });

    if (isFirstActionOfTurn) {
      console.log("🎲 Initializing dice state for turn");
      // Initialize dice state for the turn
      movementAndDice.setDiceValues(turnContext.diceRolled);
      movementAndDice.setUsedDiceIndices([]);
      movementAndDice.setSelectedDieIndex(null);

      // Show rolling animation only on first action
      movementAndDice.setIsDiceRolling(true);
      setTimeout(() => {
        movementAndDice.setIsDiceRolling(false);
      }, 1000);
    } else {
      console.log("🎲 Continuing with existing dice state");
    }

    // Always reset champion selection for new action
    movementAndDice.setSelectedChampionId(null);
    movementAndDice.setChampionMovementPath([]);

    return humanPlayer.handleHumanDiceAction(gameState, gameLog, turnContext);
  };

  const enhancedChampionSelection = (championId: number) => {
    movementAndDice.handleChampionSelection(championId, gameSession.gameState || undefined);
  };

  const enhancedTileClick = (row: number, col: number) => {
    movementAndDice.handleTileClick(row, col, gameSession.gameState || undefined);
  };

  const enhancedSaveDieForHarvest = () => {
    const resolver = humanPlayer.humanDiceActionContext?.resolver;
    const onAllDiceUsed = () => {
      humanPlayer.setHumanDiceActionContext(null);
    };
    movementAndDice.handleSaveDieForHarvest(resolver, onAllDiceUsed);
  };

  const enhancedMovementDone = () => {
    const resolver = humanPlayer.humanDiceActionContext?.resolver;
    const onAllDiceUsed = () => {
      humanPlayer.setHumanDiceActionContext(null);
    };
    movementAndDice.handleMovementDone(gameSession.gameState || undefined, resolver, onAllDiceUsed);
  };

  const enhancedTileActionConfirm = (tileAction: import("@/lib/actionTypes").TileAction) => {
    const resolver = humanPlayer.humanDiceActionContext?.resolver;
    movementAndDice.handleTileActionConfirm(tileAction, resolver);

    // Check if all dice are used
    if (movementAndDice.usedDiceIndices.length + 1 >= movementAndDice.diceValues.length) {
      humanPlayer.setHumanDiceActionContext(null);
    }
  };

  const handleStartNewGame = async () => {
    gameSession.setReplayIndex(null);
    await gameSetup.startNewGame(
      gameSession.setGameSession,
      gameSession.setGameState,
      gameSession.setSimulationState,
      gameSession.setActionLog,
      gameSession.setStatistics,
      gameSession.setSnapshots,
      setCurrentView,
      gameSession.setAutoPlay,
      {
        onDiceActionNeeded: enhancedHumanDiceAction,
        onDecisionNeeded: humanPlayer.handleHumanDecision,
        onTraderDecisionNeeded: traderModal.openTraderModal,
        onHarvestDecisionNeeded: buildingModal.openBuildingModal,
      },
    );
  };

  const handleSaveMatch = async () => {
    if (!gameSession.gameSession) {
      return;
    }
    try {
      await downloadRecording(gameSession.gameSession.getRecording());
    } catch (error) {
      console.error("Failed to save match:", error);
      alert(`Failed to save match: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleLoadMatch = async (file: File) => {
    try {
      const recording = await readRecordingFromFile(file);
      gameSession.loadRecording(recording);
      setCurrentView("game");
      setShowActionLog(true);
    } catch (error) {
      console.error("Failed to load match:", error);
      alert(`Failed to load match: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Jump the replay to the first snapshot that includes the clicked log entry
  const handleLogEntryClick = (entryIndex: number) => {
    if (snapshots.length === 0) {
      return;
    }
    const snapshotIndex = snapshots.findIndex((snapshot) => snapshot.logLength > entryIndex);
    gameSession.setReplayIndex(snapshotIndex === -1 ? snapshots.length - 1 : snapshotIndex);
  };

  const toggleAutoPlay = () => {
    gameSession.setAutoPlay(!gameSession.autoPlay);
  };

  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  const toggleAllowDragging = () => {
    setAllowDragging(!allowDragging);
  };

  const handleExtraInstructionsChange = (playerName: string, instructions: string) => {
    if (gameSession.gameState && gameSession.gameSession) {
      const player = gameSession.gameState.getPlayer(playerName);
      if (player) {
        player.extraInstructions = instructions;
        // Force a re-render by incrementing counter
        setForceRender((prev) => prev + 1);
        // Update the game session's internal state
        gameSession.gameSession.updateGameState(gameSession.gameState);
      }
    }
  };

  const handleCopyGamestate = async () => {
    if (!displayedGameState) {
      alert("No game state available to copy");
      return;
    }

    try {
      const gamestateText = stringifyGameState(displayedGameState);
      await navigator.clipboard.writeText(gamestateText);
      setCopyGamestateSuccess(true);
      setTimeout(() => setCopyGamestateSuccess(false), 2000); // Hide success message after 2 seconds
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      alert("Failed to copy game state to clipboard");
    }
  };

  // Show loading state until client-side rendering is ready
  if (!mounted) {
    return (
      <>
        <Head>
          <title>Lords of Doomspire - Game Simulation</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <style dangerouslySetInnerHTML={{ __html: spinnerStyles }} />
        </Head>
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#f0f8ff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Spinner size={50} />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Lords of Doomspire - Game Simulation</title>
        <meta name="description" content="Lords of Doomspire Board Game Simulation" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <style dangerouslySetInnerHTML={{ __html: spinnerStyles }} />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f0f8ff",
          fontFamily: "Arial, sans-serif",
          padding: "20px",
          overflowX: "auto",
          minWidth: "fit-content",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              margin: "0 0 15px 0",
              color: "#2c3e50",
              fontFamily: "serif",
            }}
          >
            Lords of Doomspire - Game Simulation
          </h1>

          <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
            {/* View Switching Buttons - Only show when game is active */}
            {(gameSession.simulationState === "playing" ||
              gameSession.simulationState === "finished" ||
              gameSession.simulationState === "replay") && (
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  onClick={() => setCurrentView("game")}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: currentView === "game" ? "#2c3e50" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                    transition: "all 0.2s ease",
                  }}
                >
                  Game View
                </button>
                <button
                  onClick={() => setCurrentView("statistics")}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: currentView === "statistics" ? "#2c3e50" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                    transition: "all 0.2s ease",
                  }}
                >
                  Statistics View
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <a
                href="/cheat-sheet"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#8b4513",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "2px solid #654321",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#a0522d";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#8b4513";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                📋 Game Reference
              </a>

              <a
                href="https://github.com/hkniberg/doomspire/blob/main/docs/game-rules.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#8b4513",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "2px solid #654321",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#a0522d";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#8b4513";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                📖 Game Rules
              </a>

              <a
                href="https://github.com/hkniberg/doomspire/blob/main/docs/history.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#8b4513",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "2px solid #654321",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#a0522d";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#8b4513";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                📜 Rules History
              </a>

              <a
                href="/fate-cards"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#8b4513",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "2px solid #654321",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#a0522d";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#8b4513";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                🎴 Fate Cards
              </a>

              <SettingsMenu
                debugMode={debugMode}
                onToggleDebugMode={toggleDebugMode}
                allowDragging={allowDragging}
                onToggleAllowDragging={toggleAllowDragging}
              />
            </div>

            {/* Token Usage Widget */}
            {gameSession.gameSession && Object.keys(gameSetup.claudeTokenTrackers).length > 0 && (
              <TokenUsage tokenUsageTrackers={Object.values(gameSetup.claudeTokenTrackers)} />
            )}

            {/* Copy Gamestate Button */}
            {displayedGameState && (
              <button
                onClick={handleCopyGamestate}
                style={{
                  padding: "10px 20px",
                  backgroundColor: copyGamestateSuccess ? "#28a745" : "#6f42c1",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseOver={(e) => {
                  if (!copyGamestateSuccess) {
                    e.currentTarget.style.backgroundColor = "#8a5cf5";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!copyGamestateSuccess) {
                    e.currentTarget.style.backgroundColor = "#6f42c1";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                {copyGamestateSuccess ? "✅ Copied!" : "📋 Copy Gamestate"}
              </button>
            )}
          </div>
        </div>

        {/* Player Configuration Panel */}
        {gameSession.simulationState === "setup" && (
          <PlayerConfigurationPanel
            playerConfigs={gameSetup.playerConfigs}
            gameConfig={gameSetup.gameConfig}
            apiKey={gameSetup.apiKey}
            hasClaudePlayers={gameSetup.hasClaudePlayers}
            onUpdatePlayerConfig={gameSetup.updatePlayerConfig}
            onUpdateGameConfig={gameSetup.setGameConfig}
            onShowApiKeyModal={() => gameSetup.setShowApiKeyModal(true)}
          />
        )}

        {/* Control Panel - Always visible */}
        <ControlPanel
          simulationState={gameSession.simulationState}
          isExecutingTurn={gameSession.isExecutingTurn}
          autoPlay={gameSession.autoPlay}
          autoPlaySpeed={gameSession.autoPlaySpeed}
          showActionLog={showActionLog}
          isStartingGame={gameSetup.isStartingGame}
          onStartNewGame={handleStartNewGame}
          onExecuteNextTurn={gameSession.executeNextTurn}
          onToggleAutoPlay={toggleAutoPlay}
          onSetAutoPlaySpeed={gameSession.setAutoPlaySpeed}
          onResetGame={gameSession.resetGame}
          onToggleActionLog={() => setShowActionLog(!showActionLog)}
          onSaveMatch={handleSaveMatch}
          onLoadMatch={handleLoadMatch}
        />

        {/* Conditional View Rendering */}
        {currentView === "game" ? (
          <>
            {/* Game Status */}
            {displayedGameState && (
              <GameStatus
                gameState={displayedGameState}
                simulationState={gameSession.simulationState}
                actionLogLength={gameSession.actionLog.length}
              />
            )}

            {/* Replay Controls - step back and forth through recorded snapshots */}
            {snapshots.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <ReplayControls
                  snapshots={snapshots}
                  replayIndex={replayIndex}
                  onReplayIndexChange={gameSession.setReplayIndex}
                  allowLive={gameSession.simulationState !== "replay"}
                />
              </div>
            )}

            {/* Action Log */}
            <GameLog
              gameLog={displayedGameLog}
              isVisible={showActionLog}
              players={displayedGameState?.players || []}
              onEntryClick={snapshots.length > 0 ? handleLogEntryClick : undefined}
              autoScrollToBottom={isReplaying}
            />

            {/* Dice Panel and Card Decks Row */}
            {displayedGameState && (
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  gap: "20px",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                }}
              >
                {/* Human Player Dice Panel - Left Side */}
                {humanPlayer.humanDiceActionContext && movementAndDice.diceValues.length > 0 && (
                  <DicePanel
                    diceValues={movementAndDice.diceValues}
                    usedDice={movementAndDice.usedDiceIndices}
                    selectedDieIndex={movementAndDice.selectedDieIndex}
                    onDieSelect={movementAndDice.handleDieSelection}
                    isRolling={movementAndDice.isDiceRolling}
                  />
                )}

                {/* Human Player Status - Always show when human player is active */}
                {humanPlayer.humanDiceActionContext && (
                  <>
                    {/* Movement */}
                    {movementAndDice.selectedChampionId !== null && movementAndDice.championMovementPath.length > 0 && (
                      <HumanPlayerStatus
                        actionType="movement"
                        championId={movementAndDice.selectedChampionId}
                        onCancel={movementAndDice.handleMovementCancel}
                        onDone={enhancedMovementDone}
                        canCancel={movementAndDice.championMovementPath.length > 0}
                        canConfirm={movementAndDice.championMovementPath.length > 1}
                      />
                    )}

                    {/* Die selected: move a knight, or save the die for the harvest phase */}
                    {movementAndDice.selectedChampionId === null && movementAndDice.selectedDieIndex !== null && (
                      <HumanPlayerStatus
                        actionType="harvest"
                        onCancel={() => movementAndDice.setSelectedDieIndex(null)}
                        onDone={enhancedSaveDieForHarvest}
                        canCancel={true}
                        canConfirm={true}
                      />
                    )}

                    {/* Dice Selection - show when no die is selected */}
                    {movementAndDice.selectedChampionId === null && movementAndDice.selectedDieIndex === null && (
                      <HumanPlayerStatus
                        actionType="diceSelection"
                        onCancel={() => {}} // No cancel for dice selection
                        onDone={() => {}} // No done for dice selection
                        canCancel={false}
                        canConfirm={false}
                      />
                    )}
                  </>
                )}

                {/* Current Fate Card */}
                <FateCardPanel fateCard={displayedFateCard} />

                {/* Card Decks - Right Side */}
                <div style={{ flex: 1 }}>
                  <CardDecks gameSession={gameSession.gameSession} />
                </div>
              </div>
            )}

            {/* Game Board (view-only while replaying: no dragging, no human interaction, no state updates) */}
            {displayedGameState ? (
              <GameBoard
                gameState={displayedGameState}
                debugMode={debugMode}
                allowDragging={isReplaying ? false : allowDragging}
                playerConfigs={gameSession.simulationState === "replay" ? undefined : gameSetup.playerConfigs}
                claudeTokenTrackers={gameSetup.claudeTokenTrackers}
                onExtraInstructionsChange={isReplaying ? undefined : handleExtraInstructionsChange}
                onGameStateUpdate={
                  isReplaying
                    ? undefined
                    : (newGameState) => {
                        gameSession.setGameState(newGameState);
                        if (gameSession.gameSession) {
                          gameSession.gameSession.updateGameState(newGameState);
                        }
                      }
                }
                humanPlayerState={
                  !isReplaying && humanPlayer.humanDiceActionContext
                    ? {
                        selectedChampionId: movementAndDice.selectedChampionId,
                        championMovementPath: movementAndDice.championMovementPath,
                        onChampionSelect: enhancedChampionSelection,
                        onTileClick: enhancedTileClick,
                        hasSelectedDie: movementAndDice.selectedDieIndex !== null,
                      }
                    : undefined
                }
              />
            ) : gameSession.simulationState === "setup" ? (
              <div
                style={{
                  padding: "60px",
                  textAlign: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  borderRadius: "8px",
                  border: "2px dashed #ddd",
                }}
              >
                <h2 style={{ color: "#6c757d", marginBottom: "20px" }}>Welcome to Lords of Doomspire!</h2>
                <p
                  style={{
                    color: "#6c757d",
                    fontSize: "18px",
                    marginBottom: "30px",
                  }}
                >
                  Configure your players above and click "Start New Game" to begin.
                </p>
                <p style={{ color: "#6c757d", fontSize: "14px" }}>
                  Choose between Random AI and Claude AI players for strategic gameplay!
                </p>
              </div>
            ) : null}
          </>
        ) : currentView === "statistics" ? (
          <div style={{ marginTop: "20px" }}>
            <StatisticsView statistics={gameSession.statistics} />
          </div>
        ) : null}

        {/* API Key Modal */}
        <ApiKeyModal
          isOpen={gameSetup.showApiKeyModal}
          onClose={() => gameSetup.setShowApiKeyModal(false)}
          apiKey={gameSetup.apiKey}
          onApiKeyChange={gameSetup.setApiKey}
        />

        {/* Human Player Decision Modal */}
        {humanPlayer.humanDecisionContext && humanPlayer.humanDecisionResolver && (
          <HumanPlayerModal
            isOpen={true}
            decisionContext={humanPlayer.humanDecisionContext}
            onDecision={humanPlayer.humanDecisionResolver}
          />
        )}

        {/* Trader Modal */}
        {traderModal.isTraderModalOpen && traderModal.traderContext && (
          <TraderModal
            isOpen={traderModal.isTraderModalOpen}
            traderContext={traderModal.traderContext}
            onConfirm={traderModal.handleTraderDecision}
            onCancel={() => traderModal.handleTraderDecision({ actions: [], reasoning: "Cancelled by user" })}
          />
        )}

        {/* Harvest Phase Modal (harvest phase runs in parallel, so use the player the modal was opened for) */}
        {buildingModal.isBuildingModalOpen &&
          gameSession.gameState &&
          buildingModal.buildingModalPlayerName &&
          gameSession.gameState.getPlayer(buildingModal.buildingModalPlayerName) && (
            <BuildingModal
              isOpen={buildingModal.isBuildingModalOpen}
              player={gameSession.gameState.getPlayer(buildingModal.buildingModalPlayerName)!}
              savedDiceValues={buildingModal.savedDiceValues}
              eligibleHarvestTiles={buildingModal.eligibleHarvestTiles}
              onConfirm={buildingModal.handleBuildingDecision}
              onCancel={() => buildingModal.handleBuildingDecision({ reasoning: "Cancelled by user" })}
            />
          )}

        {/* Tile Action Modal */}
        {movementAndDice.tileActionModalOpen && movementAndDice.pendingChampionAction && gameSession.gameState && (
          <TileActionModal
            isOpen={movementAndDice.tileActionModalOpen}
            gameState={gameSession.gameState}
            tile={movementAndDice.pendingChampionAction.destinationTile}
            player={gameSession.gameState.getCurrentPlayer()}
            championId={movementAndDice.pendingChampionAction.championId}
            onConfirm={enhancedTileActionConfirm}
            onCancel={movementAndDice.handleTileActionCancel}
          />
        )}
      </div>
    </>
  );
}
