import Head from "next/head";
import { useState, useCallback, useEffect } from "react";
import { FATE_CARDS, FateCard, FateCardType } from "../content/fateCards";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderSimpleMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[1]) {
        parts.push(<strong key={`${lineIdx}-${match.index}`}>{match[1]}</strong>);
      } else if (match[2]) {
        parts.push(<em key={`${lineIdx}-${match.index}`}>{match[2]}</em>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    if (lineIdx > 0) {
      return [<br key={`br-${lineIdx}`} />, ...parts];
    }
    return parts;
  }).flat();
}

const TYPE_LABELS: Record<FateCardType, string> = {
  "council-yes-no": "Council Vote (YES/NO)",
  "council-target": "Council Vote (TARGET)",
  event: "Event",
  gathering: "Gathering (YES/NO)",
  minor: "Minor",
};

const TYPE_COLORS: Record<FateCardType, { bg: string; border: string; badge: string }> = {
  "council-yes-no": { bg: "#fdf2e9", border: "#e67e22", badge: "#e67e22" },
  "council-target": { bg: "#fdedec", border: "#e74c3c", badge: "#e74c3c" },
  event: { bg: "#eaf2f8", border: "#2980b9", badge: "#2980b9" },
  gathering: { bg: "#eafaf1", border: "#27ae60", badge: "#27ae60" },
  minor: { bg: "#f4ecf7", border: "#8e44ad", badge: "#8e44ad" },
};

function FateCardDisplay({
  card,
  onClick,
  clickable,
}: {
  card: FateCard;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const colors = TYPE_COLORS[card.type];
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        backgroundColor: colors.bg,
        border: `3px solid ${colors.border}`,
        borderRadius: "12px",
        padding: "24px",
        width: "380px",
        minHeight: "280px",
        cursor: clickable ? "pointer" : "default",
        transition: "all 0.2s ease",
        boxShadow: clickable
          ? "0 4px 12px rgba(0,0,0,0.15)"
          : "0 2px 8px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
      onMouseOver={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
        }
      }}
      onMouseOut={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        }
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h3 style={{ margin: 0, fontSize: "1.3rem", color: "#2c3e50" }}>{card.name}</h3>
        <span
          style={{
            backgroundColor: colors.badge,
            color: "white",
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {TYPE_LABELS[card.type]}
        </span>
      </div>
      <p style={{ margin: 0, fontStyle: "italic", color: "#7f8c8d", fontSize: "0.95rem" }}>
        &ldquo;{card.flavorText}&rdquo;
      </p>
      <div style={{ margin: 0, color: "#2c3e50", fontSize: "0.95rem", lineHeight: 1.5, flex: 1 }}>
        {renderSimpleMarkdown(card.effect)}
      </div>
    </div>
  );
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
    setDeck(shuffleArray(FATE_CARDS));
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
    setDeck(shuffleArray(FATE_CARDS));
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
