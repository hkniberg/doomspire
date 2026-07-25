import React from "react";
import { GameState } from "../game/GameState";

type SimulationState = "setup" | "playing" | "finished" | "replay";

interface GameStatusProps {
  gameState: GameState;
  simulationState: SimulationState;
  actionLogLength: number;
}

export const GameStatus: React.FC<GameStatusProps> = ({ gameState, simulationState, actionLogLength }) => {
  // No longer showing instructions in GameStatus - they're all handled by HumanPlayerStatus

  return (
    <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
      <div>
        <strong>Round:</strong> {gameState.currentRound} |<strong> Current Player:</strong>{" "}
        <span
          style={{
            color: gameState.getCurrentPlayer().color,
            fontWeight: "bold",
          }}
        >
          {gameState.getCurrentPlayer().name}
        </span>{" "}
        |<strong> Game Status:</strong> {simulationState}
        {gameState.gameEnded && gameState.winner !== undefined && (
          <span style={{ color: "#28a745", fontWeight: "bold" }}>
            {" "}
            | 🎉 Winner: {gameState.players[gameState.winner]?.name}
          </span>
        )}
      </div>
      {actionLogLength > 0 && (
        <div>
          <strong>Total Turns:</strong> {actionLogLength}
        </div>
      )}
    </div>
  );
};
