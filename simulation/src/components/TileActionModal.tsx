// Lords of Doomspire Tile Action Selection Modal

import React, { useState } from "react";
import { TileAction } from "@/lib/actionTypes";
import { GameState } from "@/game/GameState";
import { Tile, Player } from "@/lib/types";
import { GameSettings } from "@/lib/GameSettings";

interface TileActionModalProps {
  isOpen: boolean;
  gameState: GameState;
  tile: Tile;
  player: Player;
  championId: number;
  onConfirm: (tileAction: TileAction) => void;
  onCancel: () => void;
}

// Helper function to check if any tile actions are available
export const hasAnyTileActions = (gameState: GameState, tile: Tile, player: Player, championId: number): boolean => {
  // Check if can claim tile
  const canClaimTile =
    tile.tileType === "resource" &&
    tile.claimedBy === undefined;

  // Check if can conquer tile (2 fame)
  const canConquerTile =
    tile.tileType === "resource" &&
    tile.claimedBy !== undefined &&
    tile.claimedBy !== player.name &&
    player.fame >= GameSettings.CONQUER_FAME_COST &&
    !gameState.isClaimProtected(tile) &&
    gameState.getOpposingChampionsAtPosition(player.name, tile.position).length === 0;

  // Check if can bribe (2 gold)
  const canBribeTile =
    tile.tileType === "resource" &&
    tile.claimedBy !== undefined &&
    tile.claimedBy !== player.name &&
    player.resources.gold >= GameSettings.BRIBE_GOLD_COST &&
    !gameState.isClaimProtected(tile) &&
    gameState.getOpposingChampionsAtPosition(player.name, tile.position).length === 0;

  // Check if can use trader
  const canUseTrader = tile.tileType === "trader" && !player.specialTileUsesThisRound?.trader;

  // Check if can use mercenary
  const canUseMercenary = tile.tileType === "mercenary" && player.resources.gold >= GameSettings.MERCENARY_GOLD_COST && !player.specialTileUsesThisRound?.mercenary;

  // Check if can use temple
  const canUseTemple = tile.tileType === "temple" && player.fame >= GameSettings.TEMPLE_FAME_COST && !player.specialTileUsesThisRound?.temple;

  // Check if there are items to pick up
  const hasItemsToPickUp = (tile.items || []).length > 0;

  // Check if champion has items to drop
  const hasItemsToDrop = (gameState.getChampion(player.name, championId)?.items || []).length > 0;

  return (
    canClaimTile ||
    canConquerTile ||
    canBribeTile ||
    canUseTrader ||
    canUseMercenary ||
    canUseTemple ||
    hasItemsToPickUp ||
    hasItemsToDrop
  );
};

export const TileActionModal: React.FC<TileActionModalProps> = ({
  isOpen,
  gameState,
  tile,
  player,
  championId,
  onConfirm,
  onCancel,
}) => {
  // Smart defaults: automatically select "claimTile" for unclaimed resource tiles
  const getDefaultActions = (): TileAction => {
    const defaults: TileAction = {};

    // Default to claiming unclaimed resource tiles
    defaults.claimTile = true;
    defaults.useTrader = true;
    defaults.useMercenary = true;
    defaults.useTemple = true;

    return defaults;
  };

  const [selectedActions, setSelectedActions] = useState<TileAction>(getDefaultActions);

  if (!isOpen) return null;

  const canClaimTile = () => {
    return (
      tile.tileType === "resource" &&
      tile.claimedBy === undefined
    );
  };

  const canConquerTile = () => {
    return (
      tile.tileType === "resource" &&
      tile.claimedBy !== undefined &&
      tile.claimedBy !== player.name &&
      player.fame >= GameSettings.CONQUER_FAME_COST &&
      !gameState.isClaimProtected(tile) &&
      gameState.getOpposingChampionsAtPosition(player.name, tile.position).length === 0
    );
  };

  const canBribeTile = () => {
    return (
      tile.tileType === "resource" &&
      tile.claimedBy !== undefined &&
      tile.claimedBy !== player.name &&
      player.resources.gold >= GameSettings.BRIBE_GOLD_COST &&
      !gameState.isClaimProtected(tile) &&
      gameState.getOpposingChampionsAtPosition(player.name, tile.position).length === 0
    );
  };

  const canUseTrader = () => {
    return tile.tileType === "trader";
  };

  const canUseMercenary = () => {
    return tile.tileType === "mercenary" && player.resources.gold >= GameSettings.MERCENARY_GOLD_COST;
  };

  const canUseTemple = () => {
    return tile.tileType === "temple" && player.fame >= GameSettings.TEMPLE_FAME_COST;
  };

  const availableItems = tile.items || [];
  const championInventory = gameState.getChampion(player.name, championId)?.items || [];

  const handleActionChange = (actionKey: keyof TileAction, value: boolean) => {
    setSelectedActions((prev) => ({ ...prev, [actionKey]: value }));
  };

  const handleItemSelection = (actionType: "pickUpItems" | "dropItems", itemId: string, selected: boolean) => {
    setSelectedActions((prev) => {
      const currentItems = prev[actionType] || [];
      if (selected) {
        return { ...prev, [actionType]: [...currentItems, itemId] };
      } else {
        return { ...prev, [actionType]: currentItems.filter((id) => id !== itemId) };
      }
    });
  };

  const getItemId = (item: any): string => {
    return item.treasureCard?.id || item.traderItem?.id || "unknown";
  };

  const getItemName = (item: any): string => {
    return item.treasureCard?.name || item.traderItem?.name || "Unknown Item";
  };

  const getTileDescription = () => {
    if (tile.tileType === "resource") {
      const resourceText = Object.entries(tile.resources || {})
        .filter(([_, amount]) => amount > 0)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ");

      if (tile.claimedBy) {
        return `Resource tile (${resourceText}) owned by ${tile.claimedBy}`;
      } else {
        return `Unclaimed resource tile (${resourceText})`;
      }
    }

    return `${tile.tileType} tile`;
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
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "20px",
          maxWidth: "600px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, color: "#2c3e50" }}>Tile Actions - {getTileDescription()}</h3>

        <div style={{ marginBottom: "20px" }}>
          {/* Claim Tile */}
          {canClaimTile() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.claimTile || false}
                onChange={(e) => handleActionChange("claimTile", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Claim this resource tile (Recommended)
            </label>
          )}

          {/* Conquer Tile */}
          {canConquerTile() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.conquer || false}
                onChange={(e) => handleActionChange("conquer", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Conquer tile by force (costs {GameSettings.CONQUER_FAME_COST} fame)
            </label>
          )}

          {/* Bribe */}
          {canBribeTile() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.bribe || false}
                onChange={(e) => handleActionChange("bribe", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Bribe to take over tile (costs {GameSettings.BRIBE_GOLD_COST} gold)
            </label>
          )}

          {/* Use Trader */}
          {canUseTrader() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.useTrader || false}
                onChange={(e) => handleActionChange("useTrader", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Visit trader (trade resources, buy items)
            </label>
          )}

          {/* Use Mercenary */}
          {canUseMercenary() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.useMercenary || false}
                onChange={(e) => handleActionChange("useMercenary", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Hire mercenaries (costs {GameSettings.MERCENARY_GOLD_COST} gold, gain{" "}
              {GameSettings.MERCENARY_MIGHT_REWARD} might)
            </label>
          )}

          {/* Use Temple */}
          {canUseTemple() && (
            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={selectedActions.useTemple || false}
                onChange={(e) => handleActionChange("useTemple", e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Sacrifice at temple (costs {GameSettings.TEMPLE_FAME_COST} fame, gain {GameSettings.TEMPLE_MIGHT_REWARD}{" "}
              might)
            </label>
          )}

          {/* Pick up items */}
          {availableItems.length > 0 && (
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ marginBottom: "8px", color: "#34495e" }}>Pick up items from tile:</h4>
              {availableItems.map((item, index) => {
                const itemId = getItemId(item);
                const itemName = getItemName(item);
                return (
                  <label key={index} style={{ display: "block", marginLeft: "15px", marginBottom: "5px" }}>
                    <input
                      type="checkbox"
                      checked={(selectedActions.pickUpItems || []).includes(itemId)}
                      onChange={(e) => handleItemSelection("pickUpItems", itemId, e.target.checked)}
                      style={{ marginRight: "8px" }}
                    />
                    {itemName}
                  </label>
                );
              })}
            </div>
          )}

          {/* Drop items */}
          {championInventory.length > 0 && (
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ marginBottom: "8px", color: "#34495e" }}>Drop items on tile:</h4>
              {championInventory.map((item, index) => {
                const itemId = getItemId(item);
                const itemName = getItemName(item);
                const isStuck = item.stuck;
                return (
                  <label key={index} style={{ display: "block", marginLeft: "15px", marginBottom: "5px" }}>
                    <input
                      type="checkbox"
                      checked={(selectedActions.dropItems || []).includes(itemId)}
                      onChange={(e) => handleItemSelection("dropItems", itemId, e.target.checked)}
                      disabled={isStuck}
                      style={{ marginRight: "8px" }}
                    />
                    {itemName} {isStuck && "(stuck)"}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              backgroundColor: "#bdc3c7",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedActions)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#27ae60",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Confirm Actions
          </button>
        </div>
      </div>
    </div>
  );
};
