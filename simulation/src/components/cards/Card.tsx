import { formatResources } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  getTierBackgroundColor,
  getTierDescription,
  getTierSolidColor,
} from "../../lib/uiConstants";

// Helper functions to format content for each card type
export const formatMonsterContent = (monster: any): string => {
  return `**Might:** ${monster.might}  
**Fame:** ${monster.fame || 0}  
**Loot:** ${formatResources(monster.resources)}`;
};

// Monster type (beast, humanoid, troll, ...) shown as a tag on the card
export const getMonsterTypeTag = (monster: any): string | undefined => {
  if (!monster?.monsterType) return undefined;
  return monster.monsterType.charAt(0).toUpperCase() + monster.monsterType.slice(1);
};

export const formatEncounterContent = (encounter: any): string => {
  return encounter.description;
};

export const formatEventContent = (event: any): string => {
  return event.description;
};

export const formatTreasureContent = (treasure: any): string => {
  return treasure.description;
};

export const formatTraderContent = (trader: any): string => {
  return `**Cost:** ${trader.cost} Gold  
${trader.description}`;
};

// Helper function to get border color for each card type
export const getBorderColor = (cardType: string): string => {
  switch (cardType) {
    case "monster":
      return "#8B0000"; // dark red
    case "encounter":
      return "#2E8B57"; // green
    case "event":
      return "#4B0082"; // purple
    case "treasure":
      return "#8B4513"; // brown
    case "trader":
      return "#FFD700"; // gold
    default:
      return "#666666"; // gray
  }
};

interface CardProps {
  showBackside?: boolean;
  compactMode?: boolean;
  tier?: number;
  backsideImageUrl?: string; // for backside
  backsideLabel?: string; // custom label for backside (defaults to "ADVENTURE")
  showTier?: boolean; // whether to show tier circle on backside (defaults to true)
  borderColor: string;
  imageUrl?: string; // for frontside
  name?: string; // for frontside
  content?: string; // markdown string
  bottomTag?: string; // optional tag at bottom
  title?: string; // for tooltip
  contentFontSize?: string; // font size for content text
  printMode?: boolean; // disable shadows for print
  disabled?: boolean; // whether this card is disabled
  enlargeOnClick?: boolean; // show enlarged modal on click
  onClick?: () => void; // custom click handler (used when enlargeOnClick is false)
}

export const CardComponent = ({
  showBackside = false,
  compactMode = false,
  tier,
  backsideImageUrl,
  backsideLabel = "ADVENTURE",
  showTier = true,
  borderColor,
  imageUrl,
  name,
  content,
  bottomTag,
  title,
  contentFontSize = "8px",
  printMode = false,
  disabled = false,
  enlargeOnClick = false,
  onClick,
}: CardProps) => {
  const [showModal, setShowModal] = useState(false);
  const backgroundColor = getTierBackgroundColor(tier);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowModal(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleCardClick = () => {
    if (disabled) return;

    if (enlargeOnClick) {
      setShowModal(true);
    } else if (onClick) {
      onClick();
    }
  };

  // Backside view (like AdventureCardBackside)
  if (showBackside) {
    return (
      <>
        <div
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundImage: `url(${backsideImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "transparent",
            borderRadius: "6px",
            border: `2px solid ${borderColor}`,
            boxShadow: printMode ? "none" : "0 4px 8px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
            position: "relative",
            opacity: disabled ? 0.5 : 1,
            cursor: (enlargeOnClick || onClick) && !disabled ? "pointer" : "default",
          }}
          title={title}
          onClick={handleCardClick}
        >
          {/* Semi-transparent overlay for better text readability */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: disabled
                ? "rgba(255, 0, 0, 0.2)"
                : printMode
                  ? "rgba(255, 255, 255, 0.1)" // Much lighter overlay for print
                  : "rgba(255, 255, 255, 0.4)",
              borderRadius: "4px",
            }}
          />
          {disabled && (
            <div
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                backgroundColor: "#dc3545",
                color: "white",
                fontSize: "10px",
                fontWeight: "bold",
                padding: "2px 6px",
                borderRadius: "4px",
                zIndex: 2,
              }}
            >
              DISABLED
            </div>
          )}
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: printMode ? "#333" : "#333",
              textAlign: "center",
              lineHeight: "1.2",
              textTransform: "uppercase",
              letterSpacing: "1px",
              position: "relative",
              zIndex: 1,
              textShadow: printMode ? "none" : "1px 1px 2px rgba(255, 255, 255, 0.8)",
              backgroundColor: printMode ? "rgba(255, 255, 255, 0.5)" : "transparent",
              padding: printMode ? "2px 6px" : "0",
              borderRadius: printMode ? "3px" : "0",
            }}
          >
            {backsideLabel}
          </div>
          {showTier && tier && (
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: getTierSolidColor(tier),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "8px",
                position: "relative",
                zIndex: 1,
                boxShadow: printMode ? "none" : "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "white",
                  textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                {getTierDescription(tier)}
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  // Front side view
  const showContent = !compactMode && content;
  const imageHeight = showContent ? "100px" : compactMode ? "90px" : "155px";

  // Compact mode dimensions - smaller and more square
  const cardWidth = compactMode ? "110px" : CARD_WIDTH;
  const cardHeight = compactMode ? "125px" : CARD_HEIGHT;
  const imageWidth = compactMode ? "110px" : "152px";

  return (
    <>
      <div
        style={{
          width: cardWidth,
          height: cardHeight,
          backgroundColor: "white",
          borderRadius: "6px",
          border: `2px solid ${borderColor}`,
          boxShadow: printMode ? "none" : "0 4px 8px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "4px 4px 2px 4px",
          gap: "0px",
          position: "relative",
          opacity: disabled ? 0.5 : 1,
          cursor: (enlargeOnClick || onClick) && !disabled ? "pointer" : "default",
        }}
        title={title}
        onClick={handleCardClick}
      >
        {disabled && (
          <div
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              backgroundColor: "#dc3545",
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
              padding: "2px 6px",
              borderRadius: "4px",
              zIndex: 10,
            }}
          >
            DISABLED
          </div>
        )}
        {/* Image */}
        <div
          style={{
            width: imageWidth,
            height: imageHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            overflow: "hidden",
            flexShrink: 0,
            marginBottom: "3px",
          }}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt={name || "Card"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          )}
        </div>

        {/* Title */}
        {name && (
          <div
            style={{
              fontSize: compactMode ? "11px" : "11px",
              fontWeight: "bold",
              color: "#333",
              textAlign: "center",
              lineHeight: "1",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              width: "100%",
              backgroundColor,
              borderRadius: "4px",
              padding: compactMode ? "1px 2px" : "2px 4px",
              flexShrink: 0,
            }}
          >
            {name}
          </div>
        )}

        {/* Content */}
        {showContent && (
          <div
            style={{
              fontSize: "12px",
              textAlign: "center",
              lineHeight: "1.3",
              width: "100%",
              padding: "4px 2px",
              color: "#666",
              overflow: "hidden",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: contentFontSize,
                overflow: "hidden",
                flex: 1,
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <span>{children}</span>,
                  strong: ({ children }) => <strong style={{ fontWeight: "bold", color: "#333" }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: "italic", color: "#555" }}>{children}</em>,
                  code: ({ children }) => (
                    <code
                      style={{
                        backgroundColor: "#f0f0f0",
                        padding: "1px 3px",
                        borderRadius: "2px",
                        fontFamily: "monospace",
                        fontSize: contentFontSize,
                        color: "#d63384",
                      }}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {/* Bottom tag */}
            {bottomTag && (
              <div
                style={{
                  fontSize: "8px",
                  backgroundColor: bottomTag === "Follower" ? "#28a745" : "#ff6600",
                  color: "white",
                  padding: "1px 3px",
                  borderRadius: "2px",
                  marginTop: "2px",
                  flexShrink: 0,
                }}
              >
                {bottomTag}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for enlarged view */}
      {showModal && enlargeOnClick && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              transform: "scale(2)",
              transformOrigin: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardComponent
              showBackside={showBackside}
              compactMode={false}
              tier={tier}
              backsideImageUrl={backsideImageUrl}
              backsideLabel={backsideLabel}
              showTier={showTier}
              borderColor={borderColor}
              imageUrl={imageUrl}
              name={name}
              content={content}
              bottomTag={bottomTag}
              title={title}
              contentFontSize={contentFontSize}
              printMode={printMode}
              disabled={disabled}
              enlargeOnClick={false}
            />
          </div>
        </div>
      )}
    </>
  );
};
