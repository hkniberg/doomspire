import Head from "next/head";
import { useState, useCallback, useEffect } from "react";
import { FateCardDisplay } from "../components/cards/FateCard";
import { FATE_CARDS, FateCard, FIRST_FATE_CARD_ID } from "../content/fateCards";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Shuffle the deck, but keep the predecided first card (Settling) on top, as in the physical setup
function buildDeck(): FateCard[] {
  const firstCard = FATE_CARDS.find((card) => card.id === FIRST_FATE_CARD_ID);
  const rest = shuffleArray(FATE_CARDS.filter((card) => card.id !== FIRST_FATE_CARD_ID));
  return firstCard ? [firstCard, ...rest] : rest;
}

function DeckStack({ count, topCard, onDraw }: { count: number; topCard: FateCard | null; onDraw: () => void }) {
  const stackOffsets = Math.min(count, 6);
  return (
    <div style={{ position: "relative", width: "386px", height: `${300 + stackOffsets * 3}px` }}>
      {Array.from({ length: stackOffsets }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: (stackOffsets - i) * 3,
            left: (stackOffsets - i) * 2,
            backgroundColor: "#2c3e50",
            border: "3px solid #1a252f",
            borderRadius: "12px",
            width: "380px",
            height: "280px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      ))}
      {topCard && (
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          <FateCardDisplay card={topCard} onClick={onDraw} clickable />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: -28,
          width: "100%",
          textAlign: "center",
          color: "#95a5a6",
          fontSize: "0.9rem",
        }}
      >
        {count} card{count !== 1 ? "s" : ""} in deck
      </div>
    </div>
  );
}

export default function FateCardSimulator() {
  const [deck, setDeck] = useState<FateCard[]>([]);
  const [activeCard, setActiveCard] = useState<FateCard | null>(null);
  const [discardPile, setDiscardPile] = useState<FateCard[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDeck(buildDeck());
    setMounted(true);
  }, []);

  const topCard = deck.length > 0 ? deck[0] : null;

  const drawCard = useCallback(() => {
    if (!topCard) return;
    if (activeCard) {
      setDiscardPile((prev) => [activeCard, ...prev]);
    }
    setActiveCard(topCard);
    setDeck((prev) => prev.slice(1));
  }, [topCard, activeCard]);

  const reset = useCallback(() => {
    setDeck(buildDeck());
    setActiveCard(null);
    setDiscardPile([]);
  }, []);

  return (
    <>
      <Head>
        <title>Lords of Doomspire - Fate Card Simulator</title>
        <meta name="description" content="Fate Card Simulator for Lords of Doomspire" />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f0f8ff",
          fontFamily: "Arial, sans-serif",
          padding: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          <h1 style={{ margin: 0, color: "#2c3e50", fontFamily: "serif", fontSize: "2rem" }}>
            Fate Card Simulator
          </h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="/"
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Back to Game
            </a>
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                backgroundColor: "#e74c3c",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Shuffle & Reset
            </button>
          </div>
        </div>

        {!mounted ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#95a5a6" }}>Shuffling deck...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "60px", justifyContent: "center", flexWrap: "wrap" }}>
              {/* Left: Deck */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <h2 style={{ margin: 0, color: "#2c3e50", fontSize: "1.3rem" }}>Fate Deck</h2>
                {topCard ? (
                  <DeckStack count={deck.length} topCard={topCard} onDraw={drawCard} />
                ) : (
                  <div
                    style={{
                      width: "380px",
                      height: "280px",
                      border: "3px dashed #bdc3c7",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      color: "#95a5a6",
                      fontSize: "1.1rem",
                    }}
                  >
                    Deck is empty
                  </div>
                )}
              </div>

              {/* Right: Active Card */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <h2 style={{ margin: 0, color: "#2c3e50", fontSize: "1.3rem" }}>Active Fate Card</h2>
                {activeCard ? (
                  <FateCardDisplay card={activeCard} />
                ) : (
                  <div
                    style={{
                      width: "380px",
                      height: "280px",
                      border: "3px dashed #bdc3c7",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      color: "#95a5a6",
                      fontSize: "1.1rem",
                    }}
                  >
                    No card drawn yet
                  </div>
                )}
                {discardPile.length > 0 && (
                  <div style={{ color: "#95a5a6", fontSize: "0.9rem" }}>
                    {discardPile.length} card{discardPile.length !== 1 ? "s" : ""} in discard pile
                  </div>
                )}
              </div>
            </div>

            {/* Discard pile */}
            {discardPile.length > 0 && (
              <div style={{ marginTop: "40px" }}>
                <h2 style={{ color: "#95a5a6", fontSize: "1.1rem", textAlign: "center" }}>
                  Previously Drawn
                </h2>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    opacity: 0.5,
                  }}
                >
                  {discardPile.map((card, i) => (
                    <div key={`${card.id}-${i}`} style={{ transform: "scale(0.75)", transformOrigin: "top center" }}>
                      <FateCardDisplay card={card} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
