import { useRouter } from "next/router";
import {
  CardComponent,
  formatEncounterContent,
  formatEventContent,
  formatMonsterContent,
  formatTraderContent,
  formatTreasureContent,
  getBorderColor,
  getMonsterTypeTag,
} from "../components/cards/Card";
import { FateCardDisplay } from "../components/cards/FateCard";
import { ENCOUNTERS } from "../content/encounterCards";
import { EVENT_CARDS } from "../content/eventCards";
import { FATE_CARDS } from "../content/fateCards";
import { MONSTER_CARDS } from "../content/monsterCards";
import { TRADER_ITEMS } from "../content/traderItems";
import { TREASURE_CARDS } from "../content/treasureCards";
import { ALL_CARDS, ALL_TRADER_CARDS, Card, CardType } from "../lib/cards";

// Extended card type that includes trader cards and the original card data for rendering
type ExtendedCardType = CardType | "trader";
// Fate cards are rendered in their own section since they use a different (landscape) layout
type TypeFilter = ExtendedCardType | "fate" | "all";

const TYPE_FILTER_VALUES: TypeFilter[] = ["all", "monster", "event", "treasure", "encounter", "trader", "fate"];

function parseTypeFilter(value: string | string[] | undefined): TypeFilter {
  return typeof value === "string" && TYPE_FILTER_VALUES.includes(value as TypeFilter) ? (value as TypeFilter) : "all";
}

function parseTierFilter(value: string | string[] | undefined): number | "all" {
  return value === "1" || value === "2" || value === "3" ? parseInt(value) : "all";
}
type ExtendedCard = (
  | Card
  | {
      type: "trader";
      tier: number;
      id: string;
    }
) & {
  originalData: any;
};

export default function CardsPage() {
  const router = useRouter();

  // All filter state lives in the URL so views can be bookmarked and shared
  const compactMode = router.query.compact === "1";
  const hideDuplicates = router.query.unique === "1";
  const cardTypeFilter = parseTypeFilter(router.query.type);
  const tierFilter = parseTierFilter(router.query.tier);

  const updateQuery = (updates: Record<string, string | undefined>) => {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...router.query, ...updates })) {
      if (typeof value === "string" && value !== "") {
        query[key] = value;
      }
    }
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const setCardTypeFilter = (value: TypeFilter) => updateQuery({ type: value === "all" ? undefined : value });
  const setTierFilter = (value: number | "all") => updateQuery({ tier: value === "all" ? undefined : String(value) });
  const setHideDuplicates = (value: boolean) => updateQuery({ unique: value ? "1" : undefined });
  const setCompactMode = (value: boolean) => updateQuery({ compact: value ? "1" : undefined });

  // Create extended card array by looking up original data
  const allCards: ExtendedCard[] = [
    // Regular cards from ALL_CARDS array (includes disabled cards)
    ...ALL_CARDS.map((card, index) => {
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
    }),
    // Add trader cards from ALL_TRADER_CARDS array (includes disabled cards)
    ...ALL_TRADER_CARDS.map((card, index) => {
      const originalData = TRADER_ITEMS.find((t) => t.id === card.id);
      return {
        ...card,
        tier: 1, // Traders are always tier 1
        originalData,
        id: `${card.type}-${index}`,
      };
    }),
  ];

  // Apply hide duplicates filter first, then other filters
  let cardsToShow = allCards;
  if (hideDuplicates) {
    const seenCards = new Set<string>();
    cardsToShow = allCards.filter((card) => {
      // Use the original card ID for duplicate detection, not the synthetic React key ID
      const key = `${card.type}-${card.originalData?.id || "unknown"}`;
      if (seenCards.has(key)) {
        return false;
      }
      seenCards.add(key);
      return true;
    });
  }

  // Filter cards based on selected filters (fate cards are handled separately below)
  const filteredCards = cardsToShow.filter((card) => {
    const matchesType = cardTypeFilter === "all" || card.type === cardTypeFilter;
    const matchesTier = tierFilter === "all" || card.tier === tierFilter;
    return cardTypeFilter !== "fate" && matchesType && matchesTier;
  });

  // Fate cards have no tier, so hide them when a tier filter is active
  // (unless the fate type is explicitly selected, in which case the tier filter is ignored)
  const showFateCards = cardTypeFilter === "fate" || (cardTypeFilter === "all" && tierFilter === "all");

  const renderCard = (card: ExtendedCard) => {
    if (!card.originalData) {
      return null; // Skip cards without original data
    }

    const commonProps = {
      tier: card.tier,
      borderColor: getBorderColor(card.type),
      name: card.originalData.name,
      compactMode,
      disabled: false, //card.originalData.disabled,
      enlargeOnClick: true,
      title: `${card.type.charAt(0).toUpperCase() + card.type.slice(1)}: ${
        card.originalData.name
      } (Tier ${card.tier})${card.originalData.disabled ? " [DISABLED]" : ""}`,
    };

    switch (card.type) {
      case "monster":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/monsters/${card.originalData.id}.png`}
            content={formatMonsterContent(card.originalData)}
            contentFontSize="14px"
            bottomTag={getMonsterTypeTag(card.originalData)}
          />
        );
      case "event":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/events/${card.originalData.id}.png`}
            content={formatEventContent(card.originalData)}
          />
        );
      case "treasure":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/treasures/${card.originalData.id}.png`}
            content={formatTreasureContent(card.originalData)}
            bottomTag="Item"
          />
        );
      case "encounter":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/encounters/${card.originalData.id}.png`}
            content={formatEncounterContent(card.originalData)}
            bottomTag={card.originalData.follower ? "Follower" : undefined}
          />
        );
      case "trader":
        return (
          <CardComponent
            {...commonProps}
            imageUrl={`/traderItems/${card.originalData.id}.png`}
            content={formatTraderContent(card.originalData)}
            contentFontSize="10px"
            bottomTag="Item"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "20px",
          color: "#333",
          fontSize: "2.5rem",
          fontWeight: "bold",
        }}
      >
        Lords of Doomspire - Complete Deck
      </h1>

      {/* Filter Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >
        {/* Card Type Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", color: "#333" }}>Card Type:</label>
          <select
            value={cardTypeFilter}
            onChange={(e) => setCardTypeFilter(e.target.value as TypeFilter)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "2px solid #ddd",
              fontSize: "14px",
              backgroundColor: "white",
            }}
          >
            <option value="all">All Types</option>
            <option value="monster">Monsters</option>
            <option value="event">Events</option>
            <option value="treasure">Treasures</option>
            <option value="encounter">Encounters</option>
            <option value="trader">Traders</option>
            <option value="fate">Fate</option>
          </select>
        </div>

        {/* Tier Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", color: "#333" }}>Tier:</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "2px solid #ddd",
              fontSize: "14px",
              backgroundColor: "white",
            }}
          >
            <option value="all">All Tiers</option>
            <option value={1}>Tier 1</option>
            <option value={2}>Tier 2</option>
            <option value={3}>Tier 3</option>
          </select>
        </div>

        {/* Hide Duplicates Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            id="hideDuplicates"
            checked={hideDuplicates}
            onChange={(e) => setHideDuplicates(e.target.checked)}
            style={{
              width: "20px",
              height: "20px",
              accentColor: "#007bff",
            }}
          />
          <label htmlFor="hideDuplicates" style={{ fontSize: "14px", color: "#333", cursor: "pointer" }}>
            Hide Duplicates
          </label>
        </div>

        {/* Compact Mode Toggle */}
        <button
          onClick={() => setCompactMode(!compactMode)}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: compactMode ? "#28a745" : "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background-color 0.2s ease",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = compactMode ? "#218838" : "#5a6268";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = compactMode ? "#28a745" : "#6c757d";
          }}
        >
          {compactMode ? "Full Cards" : "Compact Mode"}
        </button>
      </div>

      {/* Results Count */}
      <div style={{ textAlign: "center", marginBottom: "20px", color: "#666" }}>
        Showing {filteredCards.length} of {cardsToShow.length} cards
        {showFateCards && ` + ${FATE_CARDS.length} fate cards`}
        {hideDuplicates && (
          <span style={{ fontSize: "12px", display: "block", marginTop: "4px" }}>
            ({allCards.length - cardsToShow.length} duplicates hidden)
          </span>
        )}
      </div>

      {/* Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "30px",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "20px",
          justifyItems: "center",
        }}
      >
        {filteredCards.map((card) => (
          <div key={card.id}>{renderCard(card)}</div>
        ))}
      </div>

      {/* Fate Cards (landscape layout, so they get their own section using full page width) */}
      {showFateCards && (
        <div style={{ margin: "0 auto", padding: "20px" }}>
          {cardTypeFilter === "all" && (
            <h2
              style={{
                textAlign: "center",
                color: "#333",
                marginBottom: "20px",
              }}
            >
              Fate Cards
            </h2>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: "30px",
              justifyItems: "center",
            }}
          >
            {FATE_CARDS.map((card) => (
              <FateCardDisplay key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "40px auto 0",
          padding: "20px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h2 style={{ marginBottom: "20px", color: "#333" }}>Complete Deck Statistics</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
          }}
        >
          <div>
            <h3 style={{ color: "#555", fontSize: "16px" }}>By Type</h3>
            <div style={{ fontSize: "14px", color: "#666" }}>
              <div>
                Monsters: {allCards.filter((c) => c.type === "monster").length} cards (
                {allCards.filter((c) => c.type === "monster" && !c.originalData.disabled).length} enabled,{" "}
                {allCards.filter((c) => c.type === "monster" && c.originalData.disabled).length} disabled)
              </div>
              <div>
                Events: {allCards.filter((c) => c.type === "event").length} cards (
                {allCards.filter((c) => c.type === "event" && !c.originalData.disabled).length} enabled,{" "}
                {allCards.filter((c) => c.type === "event" && c.originalData.disabled).length} disabled)
              </div>
              <div>
                Treasures: {allCards.filter((c) => c.type === "treasure").length} cards (
                {allCards.filter((c) => c.type === "treasure" && !c.originalData.disabled).length} enabled,{" "}
                {allCards.filter((c) => c.type === "treasure" && c.originalData.disabled).length} disabled)
              </div>
              <div>
                Encounters: {allCards.filter((c) => c.type === "encounter").length} cards (
                {allCards.filter((c) => c.type === "encounter" && !c.originalData.disabled).length} enabled,{" "}
                {allCards.filter((c) => c.type === "encounter" && c.originalData.disabled).length} disabled)
              </div>
              <div>
                Traders: {allCards.filter((c) => c.type === "trader").length} cards (
                {allCards.filter((c) => c.type === "trader" && !c.originalData.disabled).length} enabled,{" "}
                {allCards.filter((c) => c.type === "trader" && c.originalData.disabled).length} disabled)
              </div>
              <div>Fate: {FATE_CARDS.length} cards</div>
            </div>
          </div>
          <div>
            <h3 style={{ color: "#555", fontSize: "16px" }}>By Tier</h3>
            <div style={{ fontSize: "14px", color: "#666" }}>
              <div>Tier 1: {allCards.filter((c) => c.tier === 1).length} cards</div>
              <div>Tier 2: {allCards.filter((c) => c.tier === 2).length} cards</div>
              <div>Tier 3: {allCards.filter((c) => c.tier === 3).length} cards</div>
            </div>
          </div>
          <div>
            <h3 style={{ color: "#555", fontSize: "16px" }}>Deck Summary</h3>
            <div style={{ fontSize: "14px", color: "#666" }}>
              <div>Total cards: {allCards.length}</div>
              <div>Enabled cards: {allCards.filter((c) => !c.originalData.disabled).length}</div>
              <div>Disabled cards: {allCards.filter((c) => c.originalData.disabled).length}</div>
              <div>Unique cards: {new Set(allCards.map((c) => c.id)).size}</div>
              {hideDuplicates && (
                <div
                  style={{
                    fontSize: "12px",
                    fontStyle: "italic",
                    marginTop: "4px",
                  }}
                >
                  Currently showing unique cards only
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
