import Head from "next/head";
import React from "react";
import {
  CardComponent,
  formatEncounterContent,
  formatEventContent,
  formatMonsterContent,
  formatTraderContent,
  formatTreasureContent,
  getBorderColor,
} from "../../components/cards/Card";
import { ENCOUNTERS } from "../../content/encounterCards";
import { EVENT_CARDS } from "../../content/eventCards";
import { MONSTER_CARDS } from "../../content/monsterCards";
import { TRADER_ITEMS } from "../../content/traderItems";
import { TREASURE_CARDS } from "../../content/treasureCards";
import { Card, CARDS, TRADER_CARDS, TraderCard } from "../../lib/cards";

// Extended card type that includes the original data for rendering
type ExtendedCard = (Card | TraderCard) & {
  originalData: any;
  id: string;
};

export default function PrintCards() {
  // Card size constants for easy experimentation
  const CARD_SCALE = 1.0; // Scale factor for card visual size
  const CARD_WIDTH = 160; // Grid column width - matches card width
  const CARD_HEIGHT = 240; // Grid row height - matches card height

  // Create extended card array by looking up original data
  const adventureCards: ExtendedCard[] = CARDS.map((card, index) => {
    let originalData;

    switch (card.type) {
      case "monster":
        originalData = MONSTER_CARDS.find((m) => m.id === card.id);
        break;
      case "event":
        originalData = EVENT_CARDS.find((e) => e.id === card.id);
        break;
      case "treasure":
        originalData = TREASURE_CARDS.find((t) => t.id === card.id);
        break;
      case "encounter":
        originalData = ENCOUNTERS.find((e) => e.id === card.id);
        break;
      default:
        originalData = null;
    }

    return {
      ...card,
      originalData,
      id: `${card.type}-${index}`,
    };
  });

  // Create trader cards array
  const traderCards: ExtendedCard[] = TRADER_CARDS.map((card, index) => {
    const originalData = TRADER_ITEMS.find((t) => t.id === card.id);
    return {
      ...card,
      originalData,
      id: `${card.type}-${index}`,
    };
  });

  // Combine all cards
  const allCards = [...adventureCards, ...traderCards];

  // Filter out cards without original data
  const validCards = allCards.filter((card) => card.originalData);

  const renderCard = (card: ExtendedCard, isBackside: boolean = false) => {
    if (!card.originalData) {
      return null;
    }

    const commonProps = {
      tier: "tier" in card ? card.tier : undefined,
      borderColor: getBorderColor(card.type),
      name: card.originalData.name,
      compactMode: false,
    };

    if (isBackside) {
      // Use "trader" biome for trader cards, otherwise use the card's biome
      const biome = card.type === "trader" ? "trader" : (card as Card).biome;
      const backsideLabel = card.type === "trader" ? "Trader" : "ADVENTURE";
      return (
        <CardComponent
          {...commonProps}
          showBackside={true}
          backsideImageUrl={`/cardBacksides/${biome}.png`}
          backsideLabel={backsideLabel}
          printMode={true}
        />
      );
    }

    switch (card.type) {
      case "monster":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/monsters/${card.originalData.id}.png`}
            content={formatMonsterContent(card.originalData)}
            contentFontSize="14px"
            printMode={true}
          />
        );
      case "event":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/events/${card.originalData.id}.png`}
            content={formatEventContent(card.originalData)}
            printMode={true}
          />
        );
      case "treasure":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/treasures/${card.originalData.id}.png`}
            content={formatTreasureContent(card.originalData)}
            bottomTag="Item"
            printMode={true}
          />
        );
      case "encounter":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/encounters/${card.originalData.id}.png`}
            content={formatEncounterContent(card.originalData)}
            bottomTag={card.originalData.follower ? "Follower" : undefined}
            printMode={true}
          />
        );
      case "trader":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/traderItems/${card.originalData.id}.png`}
            content={formatTraderContent(card.originalData)}
            bottomTag="Item"
            contentFontSize="10px"
            printMode={true}
          />
        );
      default:
        return null;
    }
  };

  // Split cards into pages (9 cards per page = 3x3 layout)
  const CARDS_PER_PAGE = 9;
  const frontPages: ExtendedCard[][] = [];
  const backPages: ExtendedCard[][] = [];

  for (let i = 0; i < validCards.length; i += CARDS_PER_PAGE) {
    const pageCards = validCards.slice(i, i + CARDS_PER_PAGE);
    frontPages.push(pageCards);
    backPages.push(pageCards);
  }

  return (
    <>
      <Head>
        <title>Print Cards - Lords of Doomspire</title>
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
          grid-template-columns: repeat(3, ${CARD_WIDTH}px);
          grid-template-rows: repeat(3, ${CARD_HEIGHT}px);
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
            grid-template-columns: repeat(3, ${CARD_WIDTH}px);
            grid-template-rows: repeat(3, ${CARD_HEIGHT}px);
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
        {frontPages.map((frontPageCards, pageIndex) => {
          const backPageCards = backPages[pageIndex];

          return (
            <React.Fragment key={`page-pair-${pageIndex}`}>
              {/* Front page */}
              <div className="print-page">
                <div className="cards-grid">
                  {frontPageCards.map((card, cardIndex) => (
                    <div
                      key={`front-${card.id}-${cardIndex}`}
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
                        {renderCard(card, false)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Back page */}
              <div className="print-page">
                <div className="cards-grid">
                  {(() => {
                    // Create mirrored card positions for proper double-sided alignment
                    const mirroredCards = [];
                    for (let row = 0; row < 3; row++) {
                      const rowStart = row * 3;
                      const rowCards = backPageCards.slice(rowStart, rowStart + 3);
                      // Reverse the order within each row
                      mirroredCards.push(...rowCards.reverse());
                    }

                    return mirroredCards.map((card, cardIndex) => (
                      <div
                        key={`back-${card?.id}-${cardIndex}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {card && (
                          <div
                            style={{
                              transform: `scale(${CARD_SCALE})`,
                              transformOrigin: "center",
                            }}
                          >
                            {renderCard(card, true)}
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
