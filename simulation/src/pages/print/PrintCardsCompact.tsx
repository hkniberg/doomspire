import Head from "next/head";
import React from "react";
import {
  CardComponent,
  formatMonsterContent,
  formatTraderContent,
  formatTreasureContent,
  getBorderColor,
  getMonsterTypeTag,
} from "../../components/cards/Card";
import { MONSTER_CARDS } from "../../content/monsterCards";
import { TRADER_ITEMS } from "../../content/traderItems";
import { TREASURE_CARDS } from "../../content/treasureCards";
import { Card, CARDS, TraderCard } from "../../lib/cards";

// Extended card type that includes the original data for rendering
type ExtendedCard = (Card | TraderCard) & {
  originalData: any;
  id: string;
};

export default function PrintCardsCompact() {
  // Card size constants for compact mode
  const CARD_SCALE = 1.0;
  const CARD_WIDTH = 110; // Compact card width
  const CARD_HEIGHT = 125; // Compact card height

  // Create extended card array for monsters and treasures only
  const monsterCards: ExtendedCard[] = CARDS.filter((card) => card.type === "monster")
    .map((card, index) => {
      const originalData = MONSTER_CARDS.find((m) => m.id === card.id);
      return {
        ...card,
        originalData,
        id: `${card.type}-${index}`,
      };
    })
    .filter((card) => card.originalData);

  const treasureCards: ExtendedCard[] = CARDS.filter((card) => card.type === "treasure")
    .map((card, index) => {
      const originalData = TREASURE_CARDS.find((t) => t.id === card.id);
      return {
        ...card,
        originalData,
        id: `${card.type}-${index}`,
      };
    })
    .filter((card) => card.originalData);

  // Create trader cards array - one of each trader item
  const traderCards: ExtendedCard[] = TRADER_ITEMS.map((traderItem, index) => {
    return {
      type: "trader" as const,
      originalData: traderItem,
      id: `trader-${index}`,
    };
  });

  // Add 4 extra wolves and 4 extra bears
  const wolfCard = monsterCards.find((card) => card.originalData.name === "Wolf");
  const bearCard = monsterCards.find((card) => card.originalData.name === "Bear");

  const extraCards: ExtendedCard[] = [];

  if (wolfCard) {
    for (let i = 0; i < 4; i++) {
      extraCards.push({
        ...wolfCard,
        id: `wolf-extra-${i}`,
      });
    }
  }

  if (bearCard) {
    for (let i = 0; i < 4; i++) {
      extraCards.push({
        ...bearCard,
        id: `bear-extra-${i}`,
      });
    }
  }

  // Combine all cards
  const allCards = [...monsterCards, ...treasureCards, ...traderCards, ...extraCards];

  const renderCard = (card: ExtendedCard) => {
    if (!card.originalData) {
      return null;
    }

    const commonProps = {
      tier: "tier" in card ? card.tier : undefined,
      borderColor: getBorderColor(card.type),
      name: card.originalData.name,
      compactMode: true,
      printMode: true,
    };

    switch (card.type) {
      case "monster":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/monsters/${card.originalData.id}.png`}
            content={formatMonsterContent(card.originalData)}
            contentFontSize="8px"
            bottomTag={getMonsterTypeTag(card.originalData)}
          />
        );
      case "treasure":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/treasures/${card.originalData.id}.png`}
            content={formatTreasureContent(card.originalData)}
            bottomTag="Item"
            contentFontSize="8px"
          />
        );
      case "trader":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/traderItems/${card.originalData.id}.png`}
            content={formatTraderContent(card.originalData)}
            bottomTag="Item"
            contentFontSize="8px"
          />
        );
      default:
        return null;
    }
  };

  // Split cards into pairs for double-sided printing
  // Each physical card will have two different cards (front and back)
  const CARDS_PER_PAGE = 30; // 5x6 layout for compact cards
  const cardPairs: { front: ExtendedCard; back: ExtendedCard }[] = [];

  // Create pairs by matching cards
  for (let i = 0; i < allCards.length; i += 2) {
    if (i + 1 < allCards.length) {
      cardPairs.push({
        front: allCards[i],
        back: allCards[i + 1],
      });
    } else {
      // If odd number of cards, pair with itself
      cardPairs.push({
        front: allCards[i],
        back: allCards[i],
      });
    }
  }

  // Split pairs into pages
  const frontPages: { front: ExtendedCard; back: ExtendedCard }[][] = [];
  const backPages: { front: ExtendedCard; back: ExtendedCard }[][] = [];

  for (let i = 0; i < cardPairs.length; i += CARDS_PER_PAGE) {
    const pagePairs = cardPairs.slice(i, i + CARDS_PER_PAGE);
    frontPages.push(pagePairs);
    backPages.push(pagePairs);
  }

  return (
    <>
      <Head>
        <title>Print Compact Cards - Lords of Doomspire</title>
      </Head>

      <style jsx>{`
        .print-button {
          background: #0070f3;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          margin-bottom: 20px;
        }

        .print-page {
          padding: 20px;
          border-bottom: 2px dashed #ccc;
          margin-bottom: 20px;
        }

        .print-page:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(5, ${CARD_WIDTH}px);
          grid-template-rows: repeat(6, ${CARD_HEIGHT}px);
          gap: 0px;
          justify-content: center;
        }

        @media print {
          .print-button {
            display: none !important;
          }

          .outer-container {
            padding: 0 !important;
          }

          /* Force colors to print */
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-page {
            page-break-after: always;
            break-after: page;
            padding: 0.5in;
            border: none;
            margin: 0;
          }

          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .cards-grid {
            display: grid;
            grid-template-columns: repeat(5, ${CARD_WIDTH}px);
            grid-template-rows: repeat(6, ${CARD_HEIGHT}px);
            gap: 0px;
            justify-content: center;
          }
        }
      `}</style>

      <div className="outer-container" style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <button className="print-button" onClick={() => window.print()}>
          📄 Print / Save as PDF
        </button>

        {/* Alternating front and back pages */}
        {frontPages.map((frontPagePairs, pageIndex) => {
          const backPagePairs = backPages[pageIndex];

          return (
            <React.Fragment key={`page-pair-${pageIndex}`}>
              {/* Front page */}
              <div className="print-page">
                <div className="cards-grid">
                  {frontPagePairs.map((pair, cardIndex) => (
                    <div
                      key={`front-${pair.front.id}-${cardIndex}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${CARD_SCALE})`,
                          transformOrigin: "center",
                        }}
                      >
                        {renderCard(pair.front)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Back page */}
              <div className="print-page">
                <div className="cards-grid">
                  {(() => {
                    // Horizontally invert the entire grid for proper double-sided alignment
                    const invertedPairs = [];
                    for (let row = 0; row < 6; row++) {
                      for (let col = 4; col >= 0; col--) {
                        // Go from right to left
                        const cardIndex = row * 5 + col;
                        if (cardIndex < backPagePairs.length) {
                          invertedPairs.push(backPagePairs[cardIndex]);
                        }
                      }
                    }

                    return invertedPairs.map((pair, cardIndex) => (
                      <div
                        key={`back-${pair?.back.id}-${cardIndex}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {pair && (
                          <div
                            style={{
                              transform: `scale(${CARD_SCALE})`,
                              transformOrigin: "center",
                            }}
                          >
                            {renderCard(pair.back)}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
