import { GameState } from "../game/GameState";
import type { TokenUsageTracker } from "../lib/TokenUsageTracker";
import type { Champion, Tile } from "../lib/types";
import ArrowPath from "./ArrowPath";
import { OceanZoneComponent, oceanZones } from "./OceanZone";
import { PlayerInfoBox } from "./PlayerInfoBox";
import { TileComponent } from "./Tile";

interface HumanPlayerState {
  selectedChampionId: number | null;
  championMovementPath: { row: number; col: number }[];
  onChampionSelect: (championId: number) => void;
  onTileClick: (row: number, col: number) => void;
  hasSelectedDie: boolean;
}

interface GameBoardProps {
  gameState: GameState;
  debugMode?: boolean;
  allowDragging?: boolean;
  playerConfigs?: { name: string; type: string; model?: string }[]; // Player configurations to determine types (and model for claude players)
  claudeTokenTrackers?: Record<string, TokenUsageTracker>; // Per-player token usage trackers for Claude players, keyed by player name
  onExtraInstructionsChange?: (playerName: string, instructions: string) => void; // Callback for updating extra instructions
  onGameStateUpdate?: (newGameState: GameState) => void; // Callback for updating game state
  humanPlayerState?: HumanPlayerState; // Human player interaction state
}

// Player color scheme - uses the color stored in the player's profile
const getPlayerColor = (playerName: string, gameState: GameState): { main: string; light: string; dark: string } => {
  const player = gameState.players.find((p) => p.name === playerName);
  if (!player) {
    // Fallback to red if player not found
    return { main: "#e74c3c", light: "#fadbd8", dark: "#c0392b" };
  }

  // Create light and dark variants based on the player's assigned color
  const colorVariants: Record<string, { main: string; light: string; dark: string }> = {
    "#e74c3c": { main: "#e74c3c", light: "#fadbd8", dark: "#c0392b" }, // Red
    "#3498db": { main: "#3498db", light: "#d6eaf8", dark: "#2980b9" }, // Blue
    "#2ecc71": { main: "#2ecc71", light: "#d5f4e6", dark: "#27ae60" }, // Green
    "#f39c12": { main: "#f39c12", light: "#fdeaa7", dark: "#e67e22" }, // Orange
  };

  return colorVariants[player.color] || { main: player.color, light: player.color + "40", dark: player.color };
};

export const GameBoard = ({
  gameState,
  debugMode = false,
  allowDragging = false,
  playerConfigs,
  claudeTokenTrackers,
  onExtraInstructionsChange,
  onGameStateUpdate,
  humanPlayerState,
}: GameBoardProps) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Create a getPlayerColor function that has gameState baked in
  const getPlayerColorWithState = (playerName: string) => getPlayerColor(playerName, gameState);

  const handleChampionDrop = (champion: Champion, targetTile: Tile) => {
    if (!onGameStateUpdate) return;

    // Create a new game state with the champion moved to the target tile
    const newGameState = new GameState(
      gameState.board,
      gameState.players.map((player) => {
        if (player.name === champion.playerName) {
          return {
            ...player,
            champions: player.champions.map((c) =>
              c.id === champion.id ? { ...c, position: targetTile.position } : c,
            ),
          };
        }
        return player;
      }),
      gameState.currentPlayerIndex,
      gameState.currentRound,
      gameState.gameEnded,
      gameState.winner,
    );

    onGameStateUpdate(newGameState);
  };

  const handleChampionDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "20px",
        padding: "20px",
        minWidth: "1480px", // 240px left panel + 20px gap + 1200px board + 20px padding
        width: "fit-content",
      }}
    >
      {/* Left Panel - All Players Info */}
      <div
        style={{
          width: "240px",
          flexShrink: 0, // Prevent the left panel from shrinking
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", color: "#2c3e50" }}>Players</h3>

        {gameState.players.map((player, playerIndex) => {
          const isCurrentPlayer = player.name == currentPlayer.name;
          const claimedTiles = gameState.board.getAllTiles().filter((tile) => tile.claimedBy === player.name).length;

          // Find the player type from configuration using the player index
          const playerConfig = playerConfigs?.[playerIndex];
          const playerType = playerConfig?.type;

          return (
            <PlayerInfoBox
              key={player.name}
              player={player}
              playerIndex={playerIndex}
              isCurrentPlayer={isCurrentPlayer}
              claimedTiles={claimedTiles}
              playerType={playerType}
              claudeModel={playerType === "claude" ? playerConfig?.model : undefined}
              tokenUsageTracker={claudeTokenTrackers?.[player.name]}
              onExtraInstructionsChange={onExtraInstructionsChange}
              gameState={gameState}
              getPlayerColor={getPlayerColorWithState}
            />
          );
        })}
      </div>

      {/* Game Board */}
      <div
        style={{
          position: "relative",
          width: "1200px",
          height: "1200px",
          flexShrink: 0, // Prevent the game board from shrinking
        }}
      >
        {/* Ocean layer - 2x2 grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 600px)",
            gridTemplateRows: "repeat(2, 600px)",
            gap: "0px",
            width: "1200px",
            height: "1200px",
          }}
        >
          {oceanZones.map((zone) => (
            <OceanZoneComponent
              key={zone.id}
              zone={zone}
              players={gameState.players}
              getPlayerColor={getPlayerColorWithState}
            />
          ))}
        </div>

        {/* Island layer - positioned on top of ocean */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: "2px",
            backgroundColor: "#333",
            padding: "16px",
            borderRadius: "20px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            width: "1040px",
            height: "1040px",
          }}
        >
          {gameState.board
            .getTilesGrid()
            .map((row, rowIndex) =>
              row.map((tile, colIndex) => (
                <TileComponent
                  key={`${rowIndex}-${colIndex}`}
                  tile={tile}
                  champions={gameState.players.flatMap((player) => player.champions)}
                  debugMode={debugMode}
                  allowDragging={allowDragging}
                  getPlayerColor={getPlayerColorWithState}
                  onChampionDrop={handleChampionDrop}
                  onChampionDragOver={handleChampionDragOver}
                  gameState={gameState}
                  humanPlayerState={humanPlayerState}
                />
              )),
            )}

          {/* Arrow Path Overlay for Human Player Movement */}
          {humanPlayerState?.championMovementPath &&
            humanPlayerState.championMovementPath.length > 1 &&
            humanPlayerState.selectedChampionId !== null && (
              <ArrowPath
                path={humanPlayerState.championMovementPath}
                playerColor={getPlayerColorWithState(currentPlayer.name).main}
                tileSize={126} // (1040px - 16px padding * 2 - 2px gap * 7) / 8 tiles = ~126px per tile
                boardOffset={{ x: 16, y: 16 }} // Account for padding
              />
            )}
        </div>
      </div>
    </div>
  );
};
