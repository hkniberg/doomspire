import React, { useState } from "react";
import { GameState } from "../game/GameState";
import type { Champion, ResourceType, Tile } from "../lib/types";
import { getTierSolidColor } from "../lib/uiConstants";
import { CardComponent, formatMonsterContent, formatTraderContent, getMonsterTypeTag } from "./cards/Card";
import { ChampionComponent } from "./Champion";
import { ClaimFlag } from "./ClaimFlag";
import { ResourceIcon } from "./ResourceIcon";
import { TileCardModal } from "./TileCardModal";

interface HumanPlayerState {
  selectedChampionId: number | null;
  championMovementPath: { row: number; col: number }[];
  selectedHarvestTiles?: { row: number; col: number }[];
  onChampionSelect: (championId: number) => void;
  onTileClick: (row: number, col: number) => void;
  hasSelectedDie: boolean;
}

const getTileColor = (tile: Tile): string => {
  if (!tile.explored) {
    return tile.backColor || "#8B4513"; // Use backColor or brown fallback for unexplored
  }

  // Color based on tile type
  if (tile.tileType === "resource") {
    return "#90EE90"; // Light green for resource tiles
  } else if (tile.tileType === "adventure") {
    // Tier-based colors for adventure tiles
    switch (tile.tier) {
      case 1:
        return "#90EE90"; // Light green for tier 1
      case 2:
        return "#FFB366"; // Light orange for tier 2
      case 3:
        return "#FFB3B3"; // Light red for tier 3
      default:
        return "#DDD";
    }
  } else if (tile.tileType === "doomspire") {
    return "#8B0000"; // Dark red for doomspire
  } else if (tile.tileType === "home") {
    return "#F5F5DC"; // Beige for home tiles
  } else if (["temple", "trader", "mercenary"].includes(tile.tileType || "")) {
    return "#F0F8FF"; // Alice blue for special locations
  }

  // Default based on tier
  switch (tile.tier) {
    case 1:
      return "#90EE90"; // Light green for tier 1
    case 2:
      return "#A0A0A0"; // Gray for tier 2
    case 3:
      return "#DC143C"; // Crimson for tier 3
    default:
      return "#DDD";
  }
};

const getBackgroundColor = (tile: Tile): string => {
  if (!tile.explored) {
    return getTileColor(tile);
  }

  const transparentTileTypes = ["temple", "trader", "mercenary", "doomspire", "adventure", "oasis"];
  if (transparentTileTypes.includes(tile.tileType || "")) {
    return "transparent";
  }

  return getTileColor(tile);
};

const getResourceTileImage = (tile: Tile): string => {
  if (!tile.resources) return "none";

  const resources = tile.resources;
  const hasFood = resources.food > 0;
  const hasWood = resources.wood > 0;
  const hasOre = resources.ore > 0;
  const hasGold = resources.gold > 0;

  // Single resource tiles
  if (hasFood && !hasWood && !hasOre && !hasGold) return "url(/tiles/food.png)";
  if (hasWood && !hasFood && !hasOre && !hasGold) return "url(/tiles/wood.png)";
  if (hasGold && !hasFood && !hasWood && !hasOre) return "url(/tiles/gold.png)";
  if (hasOre && !hasFood && !hasWood && !hasGold) return "url(/tiles/ore.png)";

  // Dual resource tiles
  if (hasFood && hasGold && !hasWood && !hasOre) return "url(/tiles/food-gold.png)";
  if (hasFood && hasOre && !hasWood && !hasGold) return "url(/tiles/food-ore.png)";
  if (hasFood && hasWood && !hasOre && !hasGold) return "url(/tiles/food-wood.png)";
  if (hasGold && hasOre && !hasFood && !hasWood) return "url(/tiles/gold-ore.png)";
  if (hasGold && hasWood && !hasFood && !hasOre) return "url(/tiles/gold-wood.png)";
  if (hasOre && hasWood && !hasFood && !hasGold) return "url(/tiles/ore-wood.png)";

  return "none";
};

const getBackgroundImage = (tile: Tile): string => {
  if (!tile.explored) {
    return "none";
  }

  // Simple tile types with direct image mapping
  const simpleTileImages: Record<string, string> = {
    empty: "url(/tiles/empty.png)",
    temple: "url(/tiles/temple.png)",
    trader: "url(/tiles/trader.png)",
    mercenary: "url(/tiles/mercenary.png)",
    doomspire: "url(/tiles/dragon.png)",
    home: "url(/tiles/home.png)",
    wolfDen: "url(/tiles/wolfDen.png)",
    bearCave: "url(/tiles/bearCave.png)",
  };

  if (tile.tileType && simpleTileImages[tile.tileType]) {
    return simpleTileImages[tile.tileType];
  }

  // Adventure tiles by tier
  if (tile.tileType === "adventure") {
    switch (tile.tier) {
      case 1:
        return "url(/tiles/adventure-tier1.png)";
      case 2:
        return "url(/tiles/adventure-tier2.png)";
      case 3:
        return "url(/tiles/adventure-tier3.png)";
      default:
        return "none";
    }
  }

  // Oasis tiles by tier
  if (tile.tileType === "oasis") {
    switch (tile.tier) {
      case 1:
        return "url(/tiles/oasis-tier1.png)";
      case 2:
        return "url(/tiles/oasis-tier2.png)";
      default:
        return "none";
    }
  }

  // Resource tiles with complex logic
  if (tile.tileType === "resource") {
    return getResourceTileImage(tile);
  }

  return "none";
};

const getTileSymbol = (tile: Tile): string => {
  if (!tile.explored) {
    return "";
  }

  // Special locations
  if (tile.tileType) {
    switch (tile.tileType) {
      case "doomspire":
        return ""; // No icon needed, uses background image
      case "adventure":
        return ""; // No symbol needed, uses centered question mark circle
      case "resource":
        return ""; // No symbol needed, resource icons are handled elsewhere
      case "temple":
        return "⛪";
      case "trader":
        return "🏪";
      case "mercenary":
        return "⚔️";
      case "home":
        return "🏰"; // Castle symbol for home tiles (fallback)
    }
  }

  return "";
};

const getSpecialLocationLabel = (tile: Tile): string => {
  if (!tile.tileType) return "";

  switch (tile.tileType) {
    case "temple":
      return "Chapel";
    case "trader":
      return "Trader";
    case "mercenary":
      return "Mercenary";
    case "home":
      return "Home";
    default:
      return "";
  }
};

export const TileComponent = ({
  tile,
  champions,
  debugMode = false,
  allowDragging = false,
  getPlayerColor,
  onChampionDrop,
  onChampionDragOver,
  gameState,
  humanPlayerState,
}: {
  tile: Tile;
  champions: Champion[];
  debugMode?: boolean;
  allowDragging?: boolean;
  getPlayerColor: (playerName: string) => {
    main: string;
    light: string;
    dark: string;
  };
  onChampionDrop?: (champion: Champion, targetTile: Tile) => void;
  onChampionDragOver?: (event: React.DragEvent) => void;
  gameState?: GameState;
  humanPlayerState?: HumanPlayerState;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const championsOnTile = champions.filter(
    (champion) => champion.position.row === tile.position.row && champion.position.col === tile.position.col,
  );

  // Create an effective tile state that considers debug mode
  const effectiveTile = {
    ...tile,
    explored: tile.explored || debugMode,
  };

  // Check if tile is blockaded using the game state logic
  const blockadingPlayer = gameState ? gameState.getClaimBlockader(effectiveTile) || undefined : undefined;
  const isBlockaded = !!blockadingPlayer;

  // Check if the claim is protected
  const isProtected = gameState && effectiveTile.claimedBy ? gameState.isClaimProtected(effectiveTile) : false;

  const specialLabel = getSpecialLocationLabel(effectiveTile);

  // Check if this tile is selected for harvest
  const isSelectedForHarvest = humanPlayerState?.selectedHarvestTiles?.some(
    (pos) => pos.row === tile.position.row && pos.col === tile.position.col,
  );

  // Determine border color - use tile's borderColor, or highlight if selected for harvest
  const borderColor = isSelectedForHarvest
    ? "#f39c12" // Orange for selected harvest tiles
    : effectiveTile.borderColor;

  // Check if there are cards (monster or items) to show in modal
  const hasCards = effectiveTile.monster || (effectiveTile.items && effectiveTile.items.length > 0);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCards) {
      setIsModalOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (onChampionDragOver) {
      onChampionDragOver(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const championData = e.dataTransfer.getData("text/plain");
      if (championData) {
        const champion = JSON.parse(championData) as Champion;
        if (onChampionDrop) {
          onChampionDrop(champion, tile);
        }
      }
    } catch (error) {
      console.error("Error parsing dropped champion data:", error);
    }
  };

  return (
    <div
      style={{
        width: "120px",
        height: "120px",
        backgroundColor: getBackgroundColor(effectiveTile),
        backgroundImage: getBackgroundImage(effectiveTile),
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        fontWeight: "bold",
        color: effectiveTile.explored ? "#000" : "#fff",
        border: isSelectedForHarvest ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
        borderRadius: "8px",
        cursor: "pointer",
        transition: "transform 0.1s",
        position: "relative",
      }}
      title={`${effectiveTile.tileType || "Terrain"} (Tier ${
        effectiveTile.tier
      }) - Position: ${effectiveTile.position.row + 1}, ${effectiveTile.position.col + 1}
${
  effectiveTile.resources && Object.keys(effectiveTile.resources).length > 0
    ? `Resources: ${Object.entries(effectiveTile.resources)
        .filter(([_, amount]) => amount > 0)
        .map(([type, amount]) => `${type}: ${amount}`)
        .join(", ")}${effectiveTile.isStarred ? " ⭐" : ""}`
    : ""
}
${effectiveTile.claimedBy ? `Claimed by Player ${effectiveTile.claimedBy}${isBlockaded ? " (BLOCKADED)" : ""}` : ""}${
        effectiveTile.monster && effectiveTile.explored
          ? `\nMonster: ${effectiveTile.monster.name} (Might: ${effectiveTile.monster.might})`
          : ""
      }${debugMode && !tile.explored ? " (DEBUG REVEALED)" : ""}\nDrop champions here to move them`}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => {
        if (humanPlayerState) {
          humanPlayerState.onTileClick(tile.position.row, tile.position.col);
        }
      }}
    >
      {/* Main tile symbol - moved to bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "4px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          width: "110px", // Ensure enough width for multiple icons
        }}
      >
        {effectiveTile.resources && effectiveTile.explored ? (
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              fontSize: "16px",
              justifyContent: "center",
              flexWrap: "wrap",
              maxWidth: "100px", // Constrain width to fit within tile
            }}
          >
            {Object.entries(effectiveTile.resources)
              .filter(([_, amount]) => amount > 0)
              .map(([type, amount]) =>
                Array.from({ length: amount }, (_, index) => (
                  <ResourceIcon key={`${type}-${index}`} resource={type as ResourceType} size="m" border={true} />
                )),
              )
              .flat()}
          </div>
        ) : specialLabel && !(effectiveTile.tileType === "home" && !tile.explored) ? (
          <>
            {effectiveTile.tileType !== "temple" &&
              effectiveTile.tileType !== "trader" &&
              effectiveTile.tileType !== "mercenary" &&
              effectiveTile.tileType !== "doomspire" && (
                <div style={{ fontSize: "24px" }}>{getTileSymbol(effectiveTile)}</div>
              )}
            {effectiveTile.tileType !== "temple" &&
              effectiveTile.tileType !== "trader" &&
              effectiveTile.tileType !== "mercenary" &&
              effectiveTile.tileType !== "doomspire" && (
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    marginTop: "2px",
                  }}
                >
                  {specialLabel}
                </div>
              )}
          </>
        ) : (
          <div style={{ fontSize: "24px" }}>{getTileSymbol(effectiveTile)}</div>
        )}
      </div>

      {/* Flag indicator */}
      {effectiveTile.claimedBy && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            left: "4px",
          }}
        >
          <ClaimFlag
            playerName={effectiveTile.claimedBy}
            getPlayerColor={getPlayerColor}
            isBlockaded={isBlockaded}
            blockadingPlayer={blockadingPlayer}
            isProtected={isProtected}
          />
        </div>
      )}

      {/* Star indicator for starred tiles */}
      {effectiveTile.isStarred && effectiveTile.explored && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            fontSize: "16px",
          }}
        >
          ⭐
        </div>
      )}

      {/* Dragon impression counter for doomspire */}
      {effectiveTile.tileType === "doomspire" &&
        effectiveTile.explored &&
        effectiveTile.impressionCounter !== undefined &&
        effectiveTile.impressionCounter > 0 && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              display: "flex",
              flexDirection: "row",
              gap: "2px",
              zIndex: 6,
            }}
          >
            {Array.from({ length: effectiveTile.impressionCounter }, (_, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#FFD700",
                  borderRadius: "50%",
                  width: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  color: "#000",
                }}
                title={`Dragon impressed ${effectiveTile.impressionCounter} time(s)`}
              >
                👑
              </div>
            ))}
          </div>
        )}

      {/* Adventure tokens as question mark circles */}
      {(effectiveTile.tileType === "adventure" || effectiveTile.tileType === "oasis") &&
        effectiveTile.explored &&
        !!effectiveTile.adventureTokens &&
        effectiveTile.adventureTokens > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "row",
              gap: "4px",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
            }}
          >
            {Array.from({ length: effectiveTile.adventureTokens }, (_, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: "bold",
                  border: "2px solid rgba(0, 0, 0, 0.3)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  color: getTierSolidColor(effectiveTile.tier),
                }}
              >
                ?
              </div>
            ))}
          </div>
        )}

      {/* Monster card */}
      {effectiveTile.monster && effectiveTile.explored && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: `translate(-50%, -55%) scale(0.7) rotate(${
              ((effectiveTile.position.row * 7 + effectiveTile.position.col * 11) % 21) - 10
            }deg)`,
            zIndex: 8,
            cursor: hasCards ? "pointer" : "default",
          }}
          onClick={handleCardClick}
        >
          <CardComponent
            tier={effectiveTile.monster.tier || effectiveTile.tier}
            borderColor={getTierSolidColor(effectiveTile.tier)}
            name={effectiveTile.monster.name}
            imageUrl={`/monsters/${effectiveTile.monster.id}.png`}
            compactMode={true}
            title={`Monster: ${effectiveTile.monster.name} (Might: ${effectiveTile.monster.might})`}
            content={formatMonsterContent(effectiveTile.monster)}
            contentFontSize="14px"
            bottomTag={getMonsterTypeTag(effectiveTile.monster)}
          />
        </div>
      )}

      {/* Items on tile */}
      {effectiveTile.items && effectiveTile.items.length > 0 && effectiveTile.explored && (
        <div
          style={{
            position: "absolute",
            top: "15%",
            right: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            zIndex: 9,
            cursor: "pointer",
          }}
          onClick={handleCardClick}
        >
          {effectiveTile.items.map((item, index) => {
            // Handle both treasure and trader items
            let name: string;
            let imageUrl: string;
            let content: string;
            let borderColor: string;
            let title: string;
            let itemId: string;

            if (item.treasureCard) {
              name = item.treasureCard.name;
              imageUrl = `/treasures/${item.treasureCard.id}.png`;
              content = item.treasureCard.description;
              borderColor = "#8B4513"; // Brown for treasures
              title = `Treasure: ${item.treasureCard.name} (Tier ${item.treasureCard.tier})`;
              itemId = item.treasureCard.id;
            } else if (item.traderItem) {
              name = item.traderItem.name;
              imageUrl = `/traderItems/${item.traderItem.id}.png`;
              content = formatTraderContent(item.traderItem);
              borderColor = "#FFD700"; // Gold for trader items
              title = `Item: ${item.traderItem.name} (Cost: ${item.traderItem.cost} gold)`;
              itemId = item.traderItem.id;
            } else {
              return null; // Invalid item
            }

            return (
              <div
                key={`${itemId}-${index}`}
                style={{
                  transform: `scale(0.7) rotate(${((index * 13 + effectiveTile.position.row * 7) % 21) - 10}deg)`,
                  transformOrigin: "center",
                }}
              >
                <CardComponent
                  tier={item.treasureCard?.tier || 1}
                  borderColor={borderColor}
                  name={name}
                  imageUrl={imageUrl}
                  compactMode={true}
                  title={title}
                  content={content}
                  contentFontSize="12px"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Champions on tile */}
      {championsOnTile.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            zIndex: 10,
          }}
        >
          {championsOnTile.map((champion) => {
            // Only allow selection of the current player's champions with a die selected
            const isCurrentPlayerChampion = gameState?.getCurrentPlayer().name === champion.playerName;
            const canSelect = humanPlayerState && isCurrentPlayerChampion && humanPlayerState.hasSelectedDie;
            // Only show as selected if it's the selected champion AND belongs to current player
            const isSelected = humanPlayerState?.selectedChampionId === champion.id && isCurrentPlayerChampion;

            return (
              <ChampionComponent
                key={champion.id}
                champion={champion}
                getPlayerColor={getPlayerColor}
                isSelected={isSelected}
                onSelect={canSelect ? () => humanPlayerState.onChampionSelect(champion.id) : undefined}
                allowDragging={allowDragging}
              />
            );
          })}
        </div>
      )}

      {/* Modal for showing cards */}
      <TileCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        monster={effectiveTile.monster}
        items={effectiveTile.items}
        tileTier={effectiveTile.tier}
        tilePosition={effectiveTile.position}
      />
    </div>
  );
};
