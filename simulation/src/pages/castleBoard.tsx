import Head from "next/head";
import React from "react";

type BuildingInfo = {
  title: string;
  cost: string;
  effect: string;
  note?: string;
  position: React.CSSProperties;
};

export default function CastleBoard() {
  // Y coordinate constants for manual adjustment
  const CHAPEL_Y = "15%";
  const MONASTERY_Y = "26%";
  const BLACKSMITH_Y = "45%";
  const FLETCHER_Y = "45%";
  const MARKET_Y = "24%";
  const WARSHIP_Y = "2%";

  // Additional box position constants
  const KNIGHT_BOX_Y = "57%";
  const BOAT_BOX_BOTTOM = "3%";
  const BOAT_BOX_LEFT = "8%";

  const buildingInfo: Record<string, BuildingInfo> = {
    chapel: {
      title: "CHAPEL",
      cost: "6 Wood, 2 Gold",
      effect: "Gain 3 Fame",
      position: { top: CHAPEL_Y, left: "50%", transform: "translateX(-50%)" },
    },
    monastery: {
      title: "MONASTERY",
      cost: "8 Wood, 3 Gold, 1 Ore",
      effect: "Chapel upgrade. Gain 5 Fame",
      position: { top: MONASTERY_Y, left: "50%", transform: "translateX(-50%)" },
    },
    blacksmith: {
      title: "BLACKSMITH",
      cost: "2 Food, 2 Ore",
      effect: "1 Gold + 2 Ore → 1 Might",
      note: "(Once per harvest)",
      position: { top: BLACKSMITH_Y, left: "12%", transform: "translateY(-50%)" },
    },
    fletcher: {
      title: "FLETCHER",
      cost: "1 Wood, 1 Food, 1 Gold, 1 Ore",
      effect: "3 Wood + 1 Ore → 1 Might",
      note: "(Once per harvest)",
      position: { top: FLETCHER_Y, right: "12%", transform: "translateY(-50%)" },
    },
    market: {
      title: "MARKET",
      cost: "2 Food, 2 Wood",
      effect: "Sell resources 2:1 for Gold",
      note: "(Any amount per harvest)",
      position: { bottom: MARKET_Y, left: "50%", transform: "translateX(-50%)" },
    },
  };

  const renderBuilding = (building: BuildingInfo, key: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        ...building.position,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        border: "2px solid #654321",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "11px",
        fontFamily: "Georgia, serif",
        color: "#2c1810",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        textAlign: "center",
        minWidth: "120px",
        maxWidth: "160px",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          fontSize: "12px",
          marginBottom: "4px",
          color: "#654321",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {building.title}
      </div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: "bold",
          marginBottom: "2px",
          color: "#8b4513",
        }}
      >
        Cost: {building.cost}
      </div>
      <div
        style={{
          fontSize: "10px",
          marginBottom: building.note ? "2px" : "0",
          color: "#2c1810",
        }}
      >
        {building.effect}
      </div>
      {building.note && (
        <div
          style={{
            fontSize: "9px",
            fontStyle: "italic",
            color: "#666",
          }}
        >
          {building.note}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Head>
        <title>Lords of Doomspire - Island Board</title>
        <meta name="description" content="Island board with building information for Lords of Doomspire" />
      </Head>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Island Board Background */}
        <div
          style={{
            position: "relative",
            width: "min(90vw, 90vh)",
            height: "min(90vw, 90vh)",
            backgroundImage: "url('/castleBoard/castleBoard.png')",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          {/* Building Information Overlays */}
          {renderBuilding(buildingInfo.chapel, "chapel")}
          {renderBuilding(buildingInfo.blacksmith, "blacksmith")}
          {renderBuilding(buildingInfo.fletcher, "fletcher")}
          {renderBuilding(buildingInfo.market, "market")}

          {/* Arrow between Chapel and Monastery */}
          <div
            style={{
              position: "absolute",
              top: `calc(${CHAPEL_Y} + 60px)`,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "24px",
              color: "#654321",
              fontWeight: "bold",
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            ↓
          </div>

          {/* Monastery (formatted like Chapel) */}
          {renderBuilding(buildingInfo.monastery, "monastery")}

          {/* Knight Recruitment Box */}
          <div
            style={{
              position: "absolute",
              top: KNIGHT_BOX_Y,
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              border: "2px solid #654321",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "11px",
              fontFamily: "Georgia, serif",
              color: "#2c1810",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              textAlign: "center",
              minWidth: "140px",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                marginBottom: "4px",
                color: "#654321",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              RECRUIT NEW KNIGHT
            </div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
                color: "#8b4513",
              }}
            >
              3 Food, 3 Gold, 1 Ore
            </div>
          </div>

          {/* Build New Boat Box */}
          <div
            style={{
              position: "absolute",
              bottom: BOAT_BOX_BOTTOM,
              left: BOAT_BOX_LEFT,
              backgroundColor: "rgba(70, 130, 180, 0.9)",
              color: "white",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontFamily: "Georgia, serif",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              textAlign: "center",
              minWidth: "120px",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              BUILD NEW BOAT
            </div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              2 Wood, 2 Gold
            </div>
          </div>

          {/* Warship Upgrade Area */}
          <div
            style={{
              position: "absolute",
              bottom: WARSHIP_Y,
              right: "6%",
              backgroundColor: "rgba(70, 130, 180, 0.9)",
              color: "white",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: "bold",
              textAlign: "center",
              fontFamily: "Georgia, serif",
              lineHeight: "1.2",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              WARSHIP UPGRADE
            </div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              2 Wood, 1 Ore, 1 Gold
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
