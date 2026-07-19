import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { ENCOUNTERS } from "../content/encounterCards";
import { EVENT_CARDS } from "../content/eventCards";
import { MONSTER_CARDS } from "../content/monsterCards";
import { TRADER_ITEMS } from "../content/traderItems";
import { TREASURE_CARDS } from "../content/treasureCards";
import { ALL_CARDS, ALL_TRADER_CARDS, Card, TraderCard } from "../lib/cards";

// Modal component for card selection
function CardSelectionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Group cards by type and tier
  const groupedCards = {
    monster: {} as Record<number, Card[]>,
    event: {} as Record<number, Card[]>,
    treasure: {} as Record<number, Card[]>,
    encounter: {} as Record<number, Card[]>,
    trader: [1] as number[], // Traders are always tier 1
  };

  // Process adventure cards
  ALL_CARDS.forEach((card) => {
    const cardType = card.type as keyof Omit<typeof groupedCards, "trader">;
    if (!groupedCards[cardType]) return;

    const tierGroup = groupedCards[cardType];
    if (!tierGroup[card.tier]) {
      tierGroup[card.tier] = [];
    }
    // Only add unique cards (by id)
    if (!tierGroup[card.tier].some((c) => c.id === card.id)) {
      tierGroup[card.tier].push(card);
    }
  });

  const toggleCard = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const toggleAll = (cards: Card[] | TraderCard[], checked: boolean) => {
    const newSelected = new Set(selectedCards);
    cards.forEach((card) => {
      if (checked) {
        newSelected.add(card.id);
      } else {
        newSelected.delete(card.id);
      }
    });
    setSelectedCards(newSelected);
  };

  const getCardName = (cardId: string, type: string) => {
    switch (type) {
      case "monster":
        return MONSTER_CARDS.find((m) => m.id === cardId)?.name || cardId;
      case "event":
        return EVENT_CARDS.find((e) => e.id === cardId)?.name || cardId;
      case "treasure":
        return TREASURE_CARDS.find((t) => t.id === cardId)?.name || cardId;
      case "encounter":
        return ENCOUNTERS.find((e) => e.id === cardId)?.name || cardId;
      case "trader":
        return TRADER_ITEMS.find((t) => t.id === cardId)?.name || cardId;
      default:
        return cardId;
    }
  };

  const handlePrintSelected = () => {
    if (selectedCards.size === 0) {
      alert("Please select at least one card to print.");
      return;
    }
    const cardIds = Array.from(selectedCards).join(",");
    window.open(`/print/PrintCards?cards=${encodeURIComponent(cardIds)}`, "_blank");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "8px",
          maxWidth: "80vw",
          maxHeight: "80vh",
          overflow: "auto",
          width: "800px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>Select Cards to Print</h2>
          <button
            onClick={onClose}
            style={{
              background: "#ccc",
              border: "none",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <button
            onClick={handlePrintSelected}
            disabled={selectedCards.size === 0}
            style={{
              backgroundColor: selectedCards.size > 0 ? "#4CAF50" : "#ccc",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "4px",
              cursor: selectedCards.size > 0 ? "pointer" : "not-allowed",
              fontSize: "16px",
              marginRight: "1rem",
            }}
          >
            Print Selected ({selectedCards.size} cards)
          </button>
          <button
            onClick={() => setSelectedCards(new Set())}
            style={{
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Clear All
          </button>
        </div>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          {/* Adventure Cards */}
          {(Object.keys(groupedCards) as Array<keyof typeof groupedCards>)
            .filter((type) => type !== "trader")
            .map((cardType) => (
              <div key={cardType} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "4px" }}>
                <h3 style={{ margin: "0 0 1rem 0", textTransform: "capitalize" }}>{cardType} Cards</h3>
                {Object.entries(groupedCards[cardType]).map(([tier, cards]) => {
                  const tierCards = cards as Card[];
                  const allSelected = tierCards.every((card) => selectedCards.has(card.id));
                  const someSelected = tierCards.some((card) => selectedCards.has(card.id));

                  return (
                    <div key={tier} style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={(e) => toggleAll(tierCards, e.target.checked)}
                          style={{ marginRight: "0.5rem" }}
                        />
                        <strong>
                          Tier {tier} ({tierCards.length} cards)
                        </strong>
                      </div>
                      <div
                        style={{
                          marginLeft: "1.5rem",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: "0.25rem",
                        }}
                      >
                        {tierCards.map((card) => (
                          <label key={card.id} style={{ display: "flex", alignItems: "center", fontSize: "14px" }}>
                            <input
                              type="checkbox"
                              checked={selectedCards.has(card.id)}
                              onChange={() => toggleCard(card.id)}
                              style={{ marginRight: "0.5rem" }}
                            />
                            {getCardName(card.id, card.type)}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Trader Cards */}
          <div style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "4px" }}>
            <h3 style={{ margin: "0 0 1rem 0" }}>Trader Cards</h3>
            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={ALL_TRADER_CARDS.every((card) => selectedCards.has(card.id))}
                  ref={(input) => {
                    if (input) {
                      const allSelected = ALL_TRADER_CARDS.every((card) => selectedCards.has(card.id));
                      const someSelected = ALL_TRADER_CARDS.some((card) => selectedCards.has(card.id));
                      input.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={(e) => toggleAll(ALL_TRADER_CARDS, e.target.checked)}
                  style={{ marginRight: "0.5rem" }}
                />
                <strong>All Trader Items ({ALL_TRADER_CARDS.length} cards)</strong>
              </div>
              <div
                style={{
                  marginLeft: "1.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "0.25rem",
                }}
              >
                {ALL_TRADER_CARDS.map((card) => (
                  <label key={card.id} style={{ display: "flex", alignItems: "center", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={selectedCards.has(card.id)}
                      onChange={() => toggleCard(card.id)}
                      style={{ marginRight: "0.5rem" }}
                    />
                    {getCardName(card.id, "trader")}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  const [showCardSelection, setShowCardSelection] = useState(false);

  return (
    <>
      <Head>
        <title>Print - Lords of Doomspire</title>
        <meta name="description" content="Print game components for Lords of Doomspire" />
      </Head>

      <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <h1>Print Game Components</h1>
        <p>Print various components for Lords of Doomspire board game.</p>

        <div style={{ marginTop: "2rem" }}>
          <Link
            href="/print/PrintTiles"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#4CAF50",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Tiles
          </Link>

          <Link
            href="/print/PrintCards"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#2196F3",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Cards
          </Link>

          <button
            onClick={() => setShowCardSelection(true)}
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#FF5722",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
              cursor: "pointer",
            }}
          >
            Print Specific Cards
          </button>

          <Link
            href="/print/PrintCardsCompact"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#9C27B0",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Compact Cards
          </Link>

          <Link
            href="/tracks"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#FF9800",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Player Tracks
          </Link>

          <Link
            href="/castleBoard"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#795548",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Island Board
          </Link>

          <Link
            href="/specialTileLabels"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#607D8B",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Special Tile Labels
          </Link>

          <Link
            href="/victoryCard"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#FFD700",
              color: "#333",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Victory Card
          </Link>

          <Link
            href="/print/knights"
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              backgroundColor: "#8B4513",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "1.1rem",
              marginRight: "1rem",
              marginBottom: "1rem",
            }}
          >
            Print Knight Cards
          </Link>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <Link
            href="/"
            style={{
              color: "#666",
              textDecoration: "none",
            }}
          >
            ← Back to Game
          </Link>
        </div>
      </div>

      <CardSelectionModal isOpen={showCardSelection} onClose={() => setShowCardSelection(false)} />
    </>
  );
}
