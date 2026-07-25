import { useEffect, useState } from "react";
import { FateCard } from "../content/fateCards";
import { FATE_CARD_HEIGHT, FATE_CARD_WIDTH, FateCardDisplay } from "./cards/FateCard";

interface FateCardPanelProps {
  fateCard: FateCard | null;
}

const SCALE = 0.5;

/**
 * Shows the fate card drawn for the current round (scaled down, click to enlarge).
 */
export const FateCardPanel = ({ fateCard }: FateCardPanelProps) => {
  const [isEnlarged, setIsEnlarged] = useState(false);

  // Close enlarged view on ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isEnlarged) {
        setIsEnlarged(false);
      }
    };
    if (isEnlarged) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEnlarged]);

  if (!fateCard) {
    return null;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#2c3e50" }}>Current Fate Card</div>
        <div
          style={{
            width: `${FATE_CARD_WIDTH * SCALE}px`,
            height: `${FATE_CARD_HEIGHT * SCALE}px`,
            overflow: "visible",
          }}
          title="Click to enlarge"
        >
          <div
            style={{
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
              width: `${FATE_CARD_WIDTH}px`,
            }}
          >
            <FateCardDisplay card={fateCard} clickable onClick={() => setIsEnlarged(true)} />
          </div>
        </div>
      </div>

      {isEnlarged && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setIsEnlarged(false)}
        >
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <FateCardDisplay card={fateCard} />
            <button
              onClick={() => setIsEnlarged(false)}
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                backgroundColor: "#ff4444",
                color: "white",
                border: "none",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};
