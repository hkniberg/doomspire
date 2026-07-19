import Head from "next/head";
import React from "react";
import {
  FATE_CARD_PRINT_HEIGHT,
  FATE_CARD_WIDTH,
  FateCardBackside,
  FateCardDisplay,
} from "../../components/cards/FateCard";
import { FATE_CARDS, FateCard } from "../../content/fateCards";

export default function PrintFateCards() {
  // Fate cards are landscape (380x340 in print), so scale down slightly to fit 2 columns on a page
  const CARD_SCALE = 0.9;
  const CELL_WIDTH = Math.ceil(FATE_CARD_WIDTH * CARD_SCALE);
  const CELL_HEIGHT = Math.ceil(FATE_CARD_PRINT_HEIGHT * CARD_SCALE);

  // 2 columns x 3 rows per page
  const COLUMNS = 2;
  const ROWS = 3;
  const CARDS_PER_PAGE = COLUMNS * ROWS;

  const pages: FateCard[][] = [];
  for (let i = 0; i < FATE_CARDS.length; i += CARDS_PER_PAGE) {
    pages.push(FATE_CARDS.slice(i, i + CARDS_PER_PAGE));
  }

  // Mirror each row horizontally so backsides align when printing double-sided
  const mirrorForBackside = (pageCards: FateCard[]): (FateCard | null)[] => {
    const mirrored: (FateCard | null)[] = [];
    for (let row = 0; row < ROWS; row++) {
      const rowCards: (FateCard | null)[] = [];
      for (let col = 0; col < COLUMNS; col++) {
        rowCards.push(pageCards[row * COLUMNS + col] ?? null);
      }
      mirrored.push(...rowCards.reverse());
    }
    return mirrored;
  };

  const cellStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <>
      <Head>
        <title>Print Fate Cards - Lords of Doomspire</title>
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
          grid-template-columns: repeat(${COLUMNS}, ${CELL_WIDTH}px);
          grid-template-rows: repeat(${ROWS}, ${CELL_HEIGHT}px);
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

          .page-info {
            display: none !important;
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
        }
      `}</style>

      <div className="outer-container" style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <button className="print-button" onClick={() => window.print()}>
          📄 Print / Save as PDF
        </button>

        <div className="page-info" style={{ marginBottom: "20px", color: "#666" }}>
          {FATE_CARDS.length} fate cards, {CARDS_PER_PAGE} per page. Front and back pages alternate for double-sided
          printing.
        </div>

        {pages.map((pageCards, pageIndex) => (
          <React.Fragment key={`page-pair-${pageIndex}`}>
            {/* Front page */}
            <div className="print-page">
              <div className="cards-grid">
                {pageCards.map((card) => (
                  <div key={`front-${card.id}`} style={cellStyle}>
                    <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: "center" }}>
                      <FateCardDisplay card={card} printMode={true} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back page (mirrored for double-sided alignment) */}
            <div className="print-page">
              <div className="cards-grid">
                {mirrorForBackside(pageCards).map((card, cellIndex) => (
                  <div key={`back-${card?.id ?? "empty"}-${cellIndex}`} style={cellStyle}>
                    {card && (
                      <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: "center" }}>
                        <FateCardBackside printMode={true} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
