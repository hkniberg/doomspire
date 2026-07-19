import { useEffect, useState } from "react";
import { ENCOUNTERS } from "../content/encounterCards";
import { EVENT_CARDS } from "../content/eventCards";
import { MONSTER_CARDS } from "../content/monsterCards";
import { TRADER_ITEMS } from "../content/traderItems";
import { TREASURE_CARDS } from "../content/treasureCards";
import { GameMaster } from "../engine/GameMaster";
import { TileTier } from "../lib/types";
import {
  CardComponent,
  formatEncounterContent,
  formatEventContent,
  formatMonsterContent,
  formatTraderContent,
  formatTreasureContent,
  getBorderColor,
  getMonsterTypeTag,
} from "./cards/Card";

interface CardDecksProps {
  gameSession: GameMaster | null;
}

interface ModalCardData {
  tier: TileTier;
  cardData: any;
  originalData: any;
  imageUrl: string;
  content: string;
  bottomTag?: string;
  deckSize: number;
}

interface TraderModalData {
  isTraderDeck: true;
  traderCards: any[];
}

export const CardDecks = ({ gameSession }: CardDecksProps) => {
  const [modalCard, setModalCard] = useState<ModalCardData | null>(null);
  const [traderModal, setTraderModal] = useState<TraderModalData | null>(null);

  // Close modal on ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (modalCard || traderModal)) {
        closeModal();
      }
    };

    if (modalCard || traderModal) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalCard, traderModal]);

  if (!gameSession) {
    return (
      <div
        style={{
          textAlign: "center",
          color: "#666",
          fontSize: "14px",
          padding: "20px",
        }}
      >
        Start a game to see the card decks
      </div>
    );
  }

  const handleCardClick = (tier: TileTier) => {
    const gameDecks = gameSession.getGameDecks();
    const topCard = gameDecks.peekTopCard(tier);
    const deckSize = gameDecks.getDeckSize(tier);

    if (!topCard) return;

    // Find the original card data
    let originalData;
    let imageUrl = "";
    let content = "";
    let bottomTag;

    switch (topCard.type) {
      case "monster":
        originalData = MONSTER_CARDS.find((m) => m.id === topCard.id);
        if (originalData) {
          imageUrl = `/monsters/${originalData.id}.png`;
          content = formatMonsterContent(originalData);
          bottomTag = getMonsterTypeTag(originalData);
        }
        break;
      case "event":
        originalData = EVENT_CARDS.find((e) => e.id === topCard.id);
        if (originalData) {
          imageUrl = `/events/${originalData.id}.png`;
          content = formatEventContent(originalData);
        }
        break;
      case "treasure":
        originalData = TREASURE_CARDS.find((t) => t.id === topCard.id);
        if (originalData) {
          imageUrl = `/treasures/${originalData.id}.png`;
          content = formatTreasureContent(originalData);
          bottomTag = "Item";
        }
        break;
      case "encounter":
        originalData = ENCOUNTERS.find((e) => e.id === topCard.id);
        if (originalData) {
          imageUrl = `/encounters/${originalData.id}.png`;
          content = formatEncounterContent(originalData);
          bottomTag = originalData.follower ? "Follower" : undefined;
        }
        break;
    }

    setModalCard({
      tier,
      cardData: topCard,
      originalData,
      imageUrl,
      content,
      bottomTag,
      deckSize,
    });
  };

  const handleTraderDeckClick = () => {
    const gameDecks = gameSession.getGameDecks();
    const traderCards = gameDecks.getAvailableTraderCards();
    setTraderModal({
      isTraderDeck: true,
      traderCards,
    });
  };

  const closeModal = () => {
    setModalCard(null);
    setTraderModal(null);
  };

  const renderCard = (tier: TileTier) => {
    const cardKey = `tier-${tier}-deck`;
    const gameDecks = gameSession.getGameDecks();
    const topCard = gameDecks.peekTopCard(tier);
    const deckSize = gameDecks.getDeckSize(tier);

    // Always show card back
    return (
      <div
        key={cardKey}
        style={{
          position: "relative",
          cursor: topCard ? "pointer" : "default",
          transition: "transform 0.2s ease",
        }}
        onClick={topCard ? () => handleCardClick(tier) : undefined}
        onMouseEnter={(e) => {
          if (topCard) e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          if (topCard) e.currentTarget.style.transform = "scale(1)";
        }}
        title={topCard ? `Click to view the top card (${deckSize} cards remaining)` : "Empty deck"}
      >
        <CardComponent
          showBackside={true}
          tier={tier}
          backsideImageUrl="/cardBacksides/adventure.png"
          borderColor="#666666"
          title={`Tier ${tier} - ${deckSize} cards remaining`}
        />
        {/* Deck counter */}
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            right: "4px",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            color: "white",
            fontSize: "20px",
            padding: "6px 12px",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          {deckSize}
        </div>
      </div>
    );
  };

  const renderTraderDeck = () => {
    const gameDecks = gameSession.getGameDecks();
    const traderDeckSize = gameDecks.getTraderDeckSize();

    return (
      <div
        style={{
          position: "relative",
          cursor: "pointer",
          transition: "transform 0.2s ease",
        }}
        onClick={handleTraderDeckClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        title={`Click to view all trader items (${traderDeckSize} cards)`}
      >
        <CardComponent
          showBackside={true}
          backsideImageUrl="/cardBacksides/trader.png"
          backsideLabel="TRADER"
          borderColor="#FFD700"
          name="Trader"
          title="Trader Items"
        />
        {/* Deck counter */}
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            right: "4px",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            color: "white",
            fontSize: "20px",
            padding: "6px 12px",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          {traderDeckSize}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "140px", // Scaled down height (280px * 0.5)
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "20px",
            transform: "scale(0.5)",
            transformOrigin: "center",
          }}
        >
          {/* Adventure card decks */}
          {[1, 2, 3].map((tier) => {
            const gameDecks = gameSession.getGameDecks();
            const deckSize = gameDecks.getDeckSize(tier as TileTier);

            // Only render deck if it has cards
            if (deckSize === 0) return null;

            return (
              <div
                key={tier}
                style={{
                  display: "flex",
                  gap: "4px",
                  alignItems: "center",
                }}
              >
                {renderCard(tier as TileTier)}
              </div>
            );
          })}

          {/* Trader deck */}
          <div style={{ marginLeft: "20px" }}>{renderTraderDeck()}</div>
        </div>
      </div>

      {/* Single card modal */}
      {modalCard && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "transparent",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardComponent
              tier={modalCard.tier}
              borderColor={getBorderColor(modalCard.cardData.type)}
              name={modalCard.originalData?.name || modalCard.cardData.id}
              imageUrl={modalCard.imageUrl}
              content={modalCard.content}
              contentFontSize={modalCard.cardData.type === "monster" ? "14px" : undefined}
              bottomTag={modalCard.bottomTag}
              title={`${modalCard.cardData.type}: ${modalCard.originalData?.name || modalCard.cardData.id} (Tier ${modalCard.tier})`}
            />

            {/* Close button */}
            <button
              onClick={closeModal}
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

            {/* Deck info */}
            <div
              style={{
                position: "absolute",
                bottom: "-40px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                color: "white",
                padding: "8px 16px",
                borderRadius: "4px",
                fontSize: "14px",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              Tier {modalCard.tier} - {modalCard.deckSize} cards remaining
            </div>
          </div>
        </div>
      )}

      {/* Trader items modal */}
      {traderModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            overflow: "auto",
          }}
          onClick={closeModal}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "95vw",
              maxHeight: "95vh",
              overflow: "auto",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              style={{
                position: "fixed",
                top: "20px",
                right: "20px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#ff4444",
                color: "white",
                border: "none",
                fontSize: "20px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1001,
              }}
              title="Close"
            >
              ×
            </button>

            {/* Title */}
            <div
              style={{
                textAlign: "center",
                color: "white",
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "20px",
              }}
            >
              Trader Deck ({traderModal.traderCards.length} cards)
            </div>

            {/* Cards grid */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "15px",
                justifyContent: "center",
                alignItems: "flex-start",
              }}
            >
              {traderModal.traderCards.map((traderCard, index) => {
                const traderItem = TRADER_ITEMS.find((item) => item.id === traderCard.id);
                if (!traderItem) return null;

                return (
                  <CardComponent
                    key={`${traderCard.id}-${index}`}
                    borderColor="#FFD700"
                    name={traderItem.name}
                    imageUrl={`/traderItems/${traderItem.id}.png`}
                    content={formatTraderContent(traderItem)}
                    bottomTag="Trader Item"
                    title={`${traderItem.name} - ${traderItem.cost} gold`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
