// Lords of Doomspire Harvest Phase Modal (harvest tiles, building usage, build action)

import React, { useState } from "react";
import { HarvestDecision, BuildAction, BuildingUsageDecision } from "@/lib/actionTypes";
import { BuildingType, MarketResourceType, Player, Position, Tile } from "@/lib/types";
import { GameSettings } from "@/lib/GameSettings";
import { ResourceIcon } from "./ResourceIcon";
import { canAfford } from "@/players/PlayerUtils";

interface BuildingModalProps {
  isOpen: boolean;
  player: Player;
  savedDiceValues: number[]; // Dice saved for harvesting during the move phase
  eligibleHarvestTiles: Tile[]; // Tiles the player can currently harvest from
  onConfirm: (decision: HarvestDecision) => void;
  onCancel: () => void;
}

type ModalStep = "harvest" | "usage" | "building";

export const BuildingModal: React.FC<BuildingModalProps> = ({
  isOpen,
  player,
  savedDiceValues,
  eligibleHarvestTiles,
  onConfirm,
  onCancel,
}) => {
  const savedDiceSum = savedDiceValues.reduce((sum, value) => sum + value, 0);
  const showHarvestStep = savedDiceValues.length > 0;

  const [currentStep, setCurrentStep] = useState<ModalStep>(showHarvestStep ? "harvest" : "usage");
  const [selectedHarvestTiles, setSelectedHarvestTiles] = useState<Position[]>([]);
  const [buildingUsageDecision, setBuildingUsageDecision] = useState<BuildingUsageDecision>({});
  const [selectedBuildAction, setSelectedBuildAction] = useState<BuildAction | null>(null);

  // Market selling state
  const [marketSales, setMarketSales] = useState<Record<MarketResourceType, number>>({
    food: 0,
    wood: 0,
    ore: 0,
  });

  if (!isOpen) return null;

  const hasBlacksmith = player.buildings.includes("blacksmith");
  const hasMarket = player.buildings.includes("market");
  const hasFletcher = player.buildings.includes("fletcher");
  const hasChapel = player.buildings.includes("chapel");
  const hasMonastery = player.buildings.includes("monastery");
  const hasWarshipUpgrade = player.buildings.includes("warshipUpgrade");

  const canUseBlacksmith = hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_USAGE_COST);
  const canUseFletcher = hasFletcher && canAfford(player, GameSettings.FLETCHER_USAGE_COST);

  const getTotalMarketValue = () => {
    return (marketSales.food + marketSales.wood + marketSales.ore) / GameSettings.MARKET_EXCHANGE_RATE;
  };

  const handleMarketResourceChange = (resource: MarketResourceType, delta: number) => {
    const currentAmount = marketSales[resource];
    const maxAvailable = player.resources[resource];
    const newAmount = Math.max(0, Math.min(maxAvailable, currentAmount + delta));

    setMarketSales((prev) => ({
      ...prev,
      [resource]: newAmount,
    }));
  };

  const handleUsageNext = () => {
    const usage: BuildingUsageDecision = {};

    if (buildingUsageDecision.useBlacksmith) {
      usage.useBlacksmith = true;
    }

    if (buildingUsageDecision.useFletcher) {
      usage.useFletcher = true;
    }

    if (getTotalMarketValue() > 0) {
      usage.sellAtMarket = { ...marketSales };
    }

    setBuildingUsageDecision(usage);
    setCurrentStep("building");
  };

  const handleFinish = () => {
    const decision: HarvestDecision = {
      harvestTiles: selectedHarvestTiles.length > 0 ? selectedHarvestTiles : undefined,
      buildingUsageDecision: Object.keys(buildingUsageDecision).length > 0 ? buildingUsageDecision : undefined,
      buildAction: selectedBuildAction || undefined,
      reasoning: "Human player harvest decision",
    };
    onConfirm(decision);
  };

  const handleCancel = () => {
    setSelectedHarvestTiles([]);
    setBuildingUsageDecision({});
    setSelectedBuildAction(null);
    setMarketSales({ food: 0, wood: 0, ore: 0 });
    setCurrentStep(showHarvestStep ? "harvest" : "usage");
    onCancel();
  };

  const toggleHarvestTile = (position: Position) => {
    const existingIndex = selectedHarvestTiles.findIndex(
      (pos) => pos.row === position.row && pos.col === position.col,
    );
    if (existingIndex !== -1) {
      setSelectedHarvestTiles(selectedHarvestTiles.filter((_, index) => index !== existingIndex));
    } else if (selectedHarvestTiles.length < savedDiceSum) {
      setSelectedHarvestTiles([...selectedHarvestTiles, position]);
    }
  };

  const getAvailableBuildActions = (): {
    action: BuildAction;
    name: string;
    cost: Record<string, number>;
    description: string;
  }[] => {
    const available = [];

    // Basic buildings
    if (!hasBlacksmith && canAfford(player, GameSettings.BLACKSMITH_COST)) {
      available.push({
        action: "blacksmith" as BuildAction,
        name: "Blacksmith",
        cost: GameSettings.BLACKSMITH_COST,
        description: "Use 3 ore + 1 gold to gain 1 might",
      });
    }

    if (!hasMarket && canAfford(player, GameSettings.MARKET_COST)) {
      available.push({
        action: "market" as BuildAction,
        name: "Market",
        cost: GameSettings.MARKET_COST,
        description: "Sell 2 resources for 1 gold",
      });
    }

    if (!hasFletcher && canAfford(player, GameSettings.FLETCHER_COST)) {
      available.push({
        action: "fletcher" as BuildAction,
        name: "Fletcher",
        cost: GameSettings.FLETCHER_COST,
        description: "Use 3 wood + 1 ore to gain 1 might",
      });
    }

    if (!hasChapel && !hasMonastery && canAfford(player, GameSettings.CHAPEL_COST)) {
      available.push({
        action: "chapel" as BuildAction,
        name: "Chapel",
        cost: GameSettings.CHAPEL_COST,
        description: "Gain 3 fame when built",
      });
    }

    if (hasChapel && !hasMonastery && canAfford(player, GameSettings.MONASTERY_COST)) {
      available.push({
        action: "upgradeChapelToMonastery" as BuildAction,
        name: "Upgrade Chapel to Monastery",
        cost: GameSettings.MONASTERY_COST,
        description: "Gain 5 fame when built",
      });
    }

    if (!hasWarshipUpgrade && canAfford(player, GameSettings.WARSHIP_UPGRADE_COST)) {
      available.push({
        action: "warshipUpgrade" as BuildAction,
        name: "Warship Upgrade",
        cost: GameSettings.WARSHIP_UPGRADE_COST,
        description: "Boats provide +2 might in combat",
      });
    }

    // Units
    if (
      player.champions.length < GameSettings.MAX_CHAMPIONS_PER_PLAYER &&
      canAfford(player, GameSettings.CHAMPION_COST)
    ) {
      available.push({
        action: "recruitChampion" as BuildAction,
        name: "Recruit Champion",
        cost: GameSettings.CHAMPION_COST,
        description: "Add a new champion to your army",
      });
    }

    if (player.boats.length < GameSettings.MAX_BOATS_PER_PLAYER && canAfford(player, GameSettings.BOAT_COST)) {
      available.push({
        action: "buildBoat" as BuildAction,
        name: "Build Boat",
        cost: GameSettings.BOAT_COST,
        description: "Add a new boat for sea travel",
      });
    }

    return available;
  };

  const renderHarvestStep = () => (
    <div>
      <h3 style={{ marginTop: 0, color: "#2c3e50", textAlign: "center", marginBottom: "16px" }}>🌾 Harvest</h3>

      <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fff3cd", borderRadius: "6px" }}>
        You saved dice {savedDiceValues.map((die) => `[${die}]`).join(" + ")} (total value {savedDiceSum}).
        Select up to {savedDiceSum} tile{savedDiceSum !== 1 ? "s" : ""} to harvest from.
      </div>

      {eligibleHarvestTiles.length === 0 ? (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#6c757d",
            fontSize: "14px",
            fontStyle: "italic",
          }}
        >
          There are no tiles you can currently harvest from.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
          {eligibleHarvestTiles.map((tile) => {
            const isSelected = selectedHarvestTiles.some(
              (pos) => pos.row === tile.position.row && pos.col === tile.position.col,
            );
            const atLimit = !isSelected && selectedHarvestTiles.length >= savedDiceSum;
            return (
              <div
                key={`${tile.position.row}-${tile.position.col}`}
                onClick={() => !atLimit && toggleHarvestTile(tile.position)}
                style={{
                  padding: "10px 12px",
                  border: `2px solid ${isSelected ? "#f39c12" : "#dee2e6"}`,
                  borderRadius: "6px",
                  backgroundColor: isSelected ? "#fff8e6" : atLimit ? "#f8f9fa" : "white",
                  cursor: atLimit ? "not-allowed" : "pointer",
                  opacity: atLimit ? 0.6 : 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: "bold", color: "#2c3e50" }}>
                  Tile ({tile.position.row}, {tile.position.col})
                </span>
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {Object.entries(tile.resources || {})
                    .filter(([, amount]) => (amount || 0) > 0)
                    .map(([resource, amount]) => (
                      <span key={resource} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                        <ResourceIcon resource={resource as any} size="s" />
                        <span style={{ fontSize: "13px", fontWeight: "bold" }}>{amount}</span>
                      </span>
                    ))}
                  {isSelected && <span style={{ color: "#f39c12", fontWeight: "bold" }}>✓</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button
          onClick={handleCancel}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => setCurrentStep("usage")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Next: Use Buildings
        </button>
      </div>
    </div>
  );

  const renderUsageStep = () => (
    <div>
      <h3 style={{ marginTop: 0, color: "#2c3e50", textAlign: "center", marginBottom: "16px" }}>🏰 Use Buildings</h3>

      {/* Player Resources */}
      <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#495057" }}>Your Resources:</h4>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {(["food", "wood", "ore", "gold"] as const).map((resource) => (
            <div key={resource} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <ResourceIcon resource={resource} size="m" />
              <span style={{ fontWeight: "bold", color: "#495057" }}>{player.resources[resource]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Available Building Actions */}
      <div style={{ marginBottom: "20px" }}>
        {/* Blacksmith */}
        {hasBlacksmith && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              backgroundColor: canUseBlacksmith ? "white" : "#f8d7da",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h5 style={{ margin: "0 0 4px 0", color: "#2c3e50" }}>🔨 Blacksmith</h5>
                <p style={{ margin: "0", fontSize: "14px", color: "#6c757d" }}>Use 3 ore + 1 gold to gain 1 might</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={buildingUsageDecision.useBlacksmith || false}
                  disabled={!canUseBlacksmith}
                  onChange={(e) =>
                    setBuildingUsageDecision((prev) => ({
                      ...prev,
                      useBlacksmith: e.target.checked,
                    }))
                  }
                />
                Use
              </label>
            </div>
          </div>
        )}

        {/* Fletcher */}
        {hasFletcher && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              backgroundColor: canUseFletcher ? "white" : "#f8d7da",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h5 style={{ margin: "0 0 4px 0", color: "#2c3e50" }}>🏹 Fletcher</h5>
                <p style={{ margin: "0", fontSize: "14px", color: "#6c757d" }}>Use 3 wood + 1 ore to gain 1 might</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={buildingUsageDecision.useFletcher || false}
                  disabled={!canUseFletcher}
                  onChange={(e) =>
                    setBuildingUsageDecision((prev) => ({
                      ...prev,
                      useFletcher: e.target.checked,
                    }))
                  }
                />
                Use
              </label>
            </div>
          </div>
        )}

        {/* Market */}
        {hasMarket && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            <div>
              <h5 style={{ margin: "0 0 8px 0", color: "#2c3e50" }}>🏪 Market</h5>
              <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#6c757d" }}>
                Sell resources (2:1 ratio for gold)
              </p>

              {(["food", "wood", "ore"] as MarketResourceType[]).map((resource) => (
                <div
                  key={resource}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ResourceIcon resource={resource} size="s" />
                    <span style={{ fontSize: "14px", textTransform: "capitalize" }}>{resource}</span>
                    <span style={{ fontSize: "12px", color: "#6c757d" }}>(have {player.resources[resource]})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => handleMarketResourceChange(resource, -1)}
                      disabled={marketSales[resource] === 0}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid #dee2e6",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        cursor: marketSales[resource] > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      -
                    </button>
                    <span style={{ minWidth: "20px", textAlign: "center", fontWeight: "bold" }}>
                      {marketSales[resource]}
                    </span>
                    <button
                      onClick={() => handleMarketResourceChange(resource, 1)}
                      disabled={marketSales[resource] >= player.resources[resource]}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid #dee2e6",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        cursor: marketSales[resource] < player.resources[resource] ? "pointer" : "not-allowed",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {getTotalMarketValue() > 0 && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "8px",
                    backgroundColor: "#e8f5e8",
                    borderRadius: "4px",
                    fontSize: "14px",
                    color: "#155724",
                  }}
                >
                  ✓ Will receive {Math.floor(getTotalMarketValue())} gold
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Buildings Message */}
        {!hasBlacksmith && !hasMarket && !hasFletcher && (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "#6c757d",
              fontSize: "14px",
              fontStyle: "italic",
            }}
          >
            You don't have any buildings to use yet.
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "space-between" }}>
        <div>
          {showHarvestStep && (
            <button
              onClick={() => setCurrentStep("harvest")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Back
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleCancel}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUsageNext}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Next: Build
          </button>
        </div>
      </div>
    </div>
  );

  const renderBuildingStep = () => {
    const availableBuildings = getAvailableBuildActions();

    return (
      <div>
        <h3 style={{ marginTop: 0, color: "#2c3e50", textAlign: "center", marginBottom: "16px" }}>🏗️ Build New</h3>

        {/* Usage Summary */}
        {Object.keys(buildingUsageDecision).length > 0 && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#d4edda",
              borderRadius: "6px",
              border: "1px solid #28a745",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", color: "#155724" }}>Building Usage Selected:</h4>
            {buildingUsageDecision.useBlacksmith && (
              <div style={{ fontSize: "14px", color: "#155724" }}>✓ Use Blacksmith (+1 might)</div>
            )}
            {buildingUsageDecision.useFletcher && (
              <div style={{ fontSize: "14px", color: "#155724" }}>✓ Use Fletcher (+1 might)</div>
            )}
            {buildingUsageDecision.sellAtMarket && (
              <div style={{ fontSize: "14px", color: "#155724" }}>
                ✓ Sell at Market:{" "}
                {Object.entries(buildingUsageDecision.sellAtMarket)
                  .filter(([_, amount]) => amount > 0)
                  .map(([resource, amount]) => `${amount} ${resource}`)
                  .join(", ")}{" "}
                for {Math.floor(getTotalMarketValue())} gold
              </div>
            )}
          </div>
        )}

        {/* Available Buildings */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 12px 0", color: "#495057" }}>Available to Build:</h4>

          {availableBuildings.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "#6c757d",
                fontSize: "14px",
                fontStyle: "italic",
              }}
            >
              No buildings available to construct.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {availableBuildings.map(({ action, name, cost, description }) => (
                <div
                  key={action}
                  onClick={() => setSelectedBuildAction(selectedBuildAction === action ? null : action)}
                  style={{
                    padding: "12px",
                    border: `2px solid ${selectedBuildAction === action ? "#007bff" : "#dee2e6"}`,
                    borderRadius: "6px",
                    backgroundColor: selectedBuildAction === action ? "#e3f2fd" : "white",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: "0 0 4px 0", color: "#2c3e50" }}>{name}</h5>
                      <p style={{ margin: "0", fontSize: "14px", color: "#6c757d" }}>{description}</p>
                    </div>
                    <div style={{ marginLeft: "12px", textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "#6c757d", marginBottom: "4px" }}>Cost:</div>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        {Object.entries(cost)
                          .filter(([_, amount]) => amount > 0)
                          .map(([resource, amount]) => (
                            <div key={resource} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <ResourceIcon resource={resource as any} size="s" />
                              <span style={{ fontSize: "12px", fontWeight: "bold" }}>{amount}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                  {selectedBuildAction === action && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: "#0056b3",
                        fontWeight: "bold",
                      }}
                    >
                      ✓ Selected for construction
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "space-between" }}>
          <button
            onClick={() => setCurrentStep("usage")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Back
          </button>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 20px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleFinish}
              style={{
                padding: "10px 20px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          minWidth: "500px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {currentStep === "harvest" ? renderHarvestStep() : currentStep === "usage" ? renderUsageStep() : renderBuildingStep()}
      </div>
    </div>
  );
};
