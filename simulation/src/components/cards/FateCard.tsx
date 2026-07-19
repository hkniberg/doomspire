import { FateCard, FateCardType } from "../../content/fateCards";

// Fate cards are landscape format, larger than regular cards to fit the effect text
export const FATE_CARD_WIDTH = 380;
export const FATE_CARD_HEIGHT = 280;
// For print, all cards must have the same fixed height (sized to fit the longest card text),
// otherwise the cut lines and double-sided alignment are off
export const FATE_CARD_PRINT_HEIGHT = 340;

export const FATE_TYPE_LABELS: Record<FateCardType, string> = {
  "council-yes-no": "Council Vote (YES/NO)",
  "council-target": "Council Vote (TARGET)",
  event: "Event",
  gathering: "Gathering (YES/NO)",
  minor: "Minor",
};

export const FATE_TYPE_COLORS: Record<FateCardType, { bg: string; border: string; badge: string }> = {
  "council-yes-no": { bg: "#fdf2e9", border: "#e67e22", badge: "#e67e22" },
  "council-target": { bg: "#fdedec", border: "#e74c3c", badge: "#e74c3c" },
  event: { bg: "#eaf2f8", border: "#2980b9", badge: "#2980b9" },
  gathering: { bg: "#eafaf1", border: "#27ae60", badge: "#27ae60" },
  minor: { bg: "#f4ecf7", border: "#8e44ad", badge: "#8e44ad" },
};

export function renderSimpleMarkdown(text: string): React.ReactNode[] {
  return text
    .split("\n")
    .map((line, lineIdx) => {
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
    })
    .flat();
}

export function FateCardDisplay({
  card,
  onClick,
  clickable,
  printMode = false,
}: {
  card: FateCard;
  onClick?: () => void;
  clickable?: boolean;
  printMode?: boolean;
}) {
  const colors = FATE_TYPE_COLORS[card.type];
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        backgroundColor: colors.bg,
        border: `3px solid ${colors.border}`,
        borderRadius: "12px",
        padding: "24px",
        width: `${FATE_CARD_WIDTH}px`,
        height: printMode ? `${FATE_CARD_PRINT_HEIGHT}px` : undefined,
        minHeight: `${FATE_CARD_HEIGHT}px`,
        overflow: printMode ? "hidden" : undefined,
        cursor: clickable ? "pointer" : "default",
        transition: "all 0.2s ease",
        boxShadow: printMode
          ? "none"
          : clickable
            ? "0 4px 12px rgba(0,0,0,0.15)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxSizing: "border-box",
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
          {FATE_TYPE_LABELS[card.type]}
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

export function FateCardBackside({ printMode = false }: { printMode?: boolean }) {
  return (
    <div
      style={{
        width: `${FATE_CARD_WIDTH}px`,
        height: printMode ? `${FATE_CARD_PRINT_HEIGHT}px` : `${FATE_CARD_HEIGHT}px`,
        backgroundImage: "url(/cardBacksides/fate.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        borderRadius: "12px",
        border: "3px solid #2c3e50",
        boxShadow: printMode ? "none" : "0 2px 8px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#f5e6c8",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "6px",
          fontFamily: "serif",
          textShadow: "0 2px 6px rgba(0, 0, 0, 0.8)",
        }}
      >
        Fate
      </div>
    </div>
  );
}
