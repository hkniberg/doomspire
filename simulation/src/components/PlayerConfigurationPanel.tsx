import React from "react";
import { ClaudeModel, DEFAULT_CLAUDE_MODEL } from "@/llm/claude";

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

interface PlayerConfigurationPanelProps {
  playerConfigs: PlayerConfig[];
  gameConfig: GameConfig;
  apiKey: string;
  hasClaudePlayers: boolean;
  onUpdatePlayerConfig: (index: number, field: keyof PlayerConfig, value: string) => void;
  onUpdateGameConfig: (config: GameConfig) => void;
  onShowApiKeyModal: () => void;
}

export function PlayerConfigurationPanel({
  playerConfigs,
  gameConfig,
  apiKey,
  hasClaudePlayers,
  onUpdatePlayerConfig,
  onUpdateGameConfig,
  onShowApiKeyModal,
}: PlayerConfigurationPanelProps) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "20px",
        border: "1px solid #ddd",
      }}
    >
      <h2 style={{ marginBottom: "15px", color: "#2c3e50" }}>Player Configuration</h2>

      {/* API Key Status */}
      {hasClaudePlayers && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              backgroundColor: apiKey ? "#d4edda" : "#f8d7da",
              border: `1px solid ${apiKey ? "#c3e6cb" : "#f5c6cb"}`,
              borderRadius: "4px",
            }}
          >
            <span style={{ fontSize: "20px" }}>{apiKey ? "🔑" : "⚠️"}</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: apiKey ? "#155724" : "#721c24" }}>
                {apiKey ? "API Key Configured" : "API Key Required"}
              </strong>
              <div
                style={{
                  fontSize: "14px",
                  color: apiKey ? "#155724" : "#721c24",
                }}
              >
                {apiKey
                  ? "Claude AI players are ready to play"
                  : "Configure your Anthropic API key to use Claude players"}
              </div>
            </div>
            <button
              onClick={onShowApiKeyModal}
              style={{
                padding: "6px 12px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              {apiKey ? "Change Key" : "Set API Key"}
            </button>
          </div>
        </div>
      )}

      {/* Player Type Selectors */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "15px",
        }}
      >
        {playerConfigs.map((config, index) => (
          <div
            key={index}
            style={{
              padding: "15px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              backgroundColor: "#f8f9fa",
            }}
          >
            <h4 style={{ marginBottom: "10px", color: "#2c3e50" }}>Player {index + 1}</h4>

            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Name:
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => onUpdatePlayerConfig(index, "name", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Type:
              </label>
              <select
                value={config.type}
                onChange={(e) => onUpdatePlayerConfig(index, "type", e.target.value as PlayerType)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                <option value="random">Random AI</option>
                <option value="claude">Claude AI</option>
                <option value="human">Human Player</option>
              </select>
            </div>

            {config.type === "claude" && (
              <div style={{ marginTop: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Model:
                </label>
                <select
                  value={config.model ?? DEFAULT_CLAUDE_MODEL}
                  onChange={(e) => onUpdatePlayerConfig(index, "model", e.target.value as ClaudeModel)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                >
                  <option value="haiku">Claude Haiku (fastest, cheapest)</option>
                  <option value="sonnet">Claude Sonnet (default)</option>
                  <option value="opus">Claude Opus (stronger, pricier)</option>
                  <option value="fable">Claude Fable (strongest, priciest)</option>
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Game Configuration */}
      <div style={{ marginTop: "20px" }}>
        <h3 style={{ marginBottom: "15px", color: "#2c3e50" }}>Game Configuration</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "12px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            backgroundColor: "#f8f9fa",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Fame:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startFame}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startFame: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Might:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startMight}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startMight: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Food:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startFood}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startFood: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Wood:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startWood}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startWood: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Ore:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startOre}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startOre: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Start Gold:
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={gameConfig.startGold}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  startGold: parseInt(e.target.value) || 0,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Max Rounds:
            </label>
            <input
              type="number"
              min="5"
              max="100"
              value={gameConfig.maxRounds}
              onChange={(e) =>
                onUpdateGameConfig({
                  ...gameConfig,
                  maxRounds: parseInt(e.target.value) || 30,
                })
              }
              style={{
                width: "80px",
                padding: "4px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
              placeholder="30"
            />
            <small style={{ fontSize: "12px", color: "#666", marginTop: "2px", display: "block" }}>
              Maximum number of game rounds before ending.
            </small>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Random Seed:
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="number"
                value={gameConfig.seed}
                onChange={(e) =>
                  onUpdateGameConfig({
                    ...gameConfig,
                    seed: parseInt(e.target.value) || 0,
                  })
                }
                style={{
                  width: "100px",
                  padding: "4px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
                placeholder="0 for default"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateGameConfig({
                    ...gameConfig,
                    seed: Math.floor(Math.random() * 1000000),
                  })
                }
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                }}
              >
                🎲 Random
              </button>
            </div>
            <small style={{ fontSize: "12px", color: "#666", marginTop: "2px", display: "block" }}>
              Controls board layout generation. Same seed = same board.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
