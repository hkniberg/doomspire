import { ENCOUNTERS } from "../content/encounterCards";
import { EVENT_CARDS } from "../content/eventCards";
import { MONSTER_CARDS } from "../content/monsterCards";
import { TRADER_ITEMS } from "../content/traderItems";
import { TREASURE_CARDS } from "../content/treasureCards";
import { AdventureThemeType, TileTier } from "./types";

/**
 * Development/Testing Configuration
 *
 * Set ONLY_INCLUDE_CARDS to an array of card IDs to only include those cards in the deck.
 * Set to undefined to include all cards as usual.
 *
 * Example: const ONLY_INCLUDE_CARDS = ['wolf', 'bear', 'landslide'];
 * Doing this also sets those cards to tier 1.
 *
 * This is useful for testing specific cards or gameplay situations.
 */
let ONLY_INCLUDE_CARDS: string[] | undefined = undefined;

export type CardType = "monster" | "event" | "treasure" | "encounter" | "follower";

export interface Card {
  type: CardType;
  tier: TileTier;
  theme: AdventureThemeType;
  id: string;
}

export interface TraderCard {
  type: "trader";
  id: string;
}

class CardDeck {
  private cards: Card[] = [];

  // Deck order: index 0 = bottom, index [length-1] = top
  // Cards are drawn from the top (end of array)

  addCard(quantity: number, card: Card): void {
    for (let i = 0; i < quantity; i++) {
      this.cards.push({ ...card }); // Add to top of deck
    }
  }

  addToTop(card: Card): void {
    this.cards.push({ ...card });
  }

  addToBottom(card: Card): void {
    this.cards.unshift({ ...card });
  }

  drawFromTop(): Card | undefined {
    return this.cards.pop(); // Remove and return top card
  }

  peekTop(): Card | undefined {
    return this.cards[this.cards.length - 1]; // Look at top card without removing
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  size(): number {
    return this.cards.length;
  }

  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  getCards(): Card[] {
    return [...this.cards]; // Return a copy (bottom to top order)
  }

  addCards(cards: Card[]): void {
    this.cards.push(...cards);
  }
}

class TraderDeck {
  private cards: TraderCard[] = [];

  // Deck order: index 0 = bottom, index [length-1] = top
  // Cards are drawn from the top (end of array)

  addCard(quantity: number, card: TraderCard): void {
    for (let i = 0; i < quantity; i++) {
      this.cards.push({ ...card }); // Add to top of deck
    }
  }

  addToTop(card: TraderCard): void {
    this.cards.push({ ...card });
  }

  addToBottom(card: TraderCard): void {
    this.cards.unshift({ ...card });
  }

  drawFromTop(): TraderCard | undefined {
    return this.cards.pop(); // Remove and return top card
  }

  peekTop(): TraderCard | undefined {
    return this.cards[this.cards.length - 1]; // Look at top card without removing
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  size(): number {
    return this.cards.length;
  }

  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  getCards(): TraderCard[] {
    return [...this.cards]; // Return a copy (bottom to top order)
  }

  addCards(cards: TraderCard[]): void {
    this.cards.push(...cards);
  }

  removeCard(itemId: string): boolean {
    const index = this.cards.findIndex((card) => card.id === itemId);
    if (index !== -1) {
      this.cards.splice(index, 1); // Remove only the first occurrence
      return true;
    }
    return false;
  }
}

export class GameDecks {
  private decks: Record<TileTier, CardDeck>;
  private traderDeck: TraderDeck;

  constructor(allCards: Card[]) {
    this.decks = {
      1: new CardDeck(),
      2: new CardDeck(),
      3: new CardDeck(),
    };

    this.traderDeck = new TraderDeck();

    this.initializeDecks(allCards);
    this.initializeTraderDeck();
  }

  private initializeDecks(allCards: Card[]): void {
    // For each tier, collect cards, shuffle, and add to single deck
    for (const tier of [1, 2, 3] as TileTier[]) {
      const tierCards = allCards.filter((card) => card.tier === tier);

      // Shuffle the tier cards
      this.shuffleArray(tierCards);

      // Add all cards to the single deck for this tier
      this.decks[tier].addCards(tierCards);
    }
  }

  private initializeTraderDeck(): void {
    // Add all trader cards to the trader deck.
    // Per the rules, the trader deck is face up and NOT shuffled - anyone may look through it.
    this.traderDeck.addCards([...TRADER_CARDS]);
  }

  private shuffleArray(array: Card[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private resetTierDecks(tier: TileTier): void {
    // Collect all tier cards, shuffle, and add to single deck
    const allTierCards = CARDS.filter((card) => card.tier === tier);
    this.shuffleArray(allTierCards);

    // Clear existing deck and add all cards
    this.decks[tier] = new CardDeck();
    this.decks[tier].addCards(allTierCards);
  }

  drawCard(tier: TileTier): Card | undefined {
    const card = this.decks[tier].drawFromTop();

    // If deck is empty, reset it and try again
    if (!card) {
      this.resetTierDecks(tier);
      return this.decks[tier].drawFromTop();
    }

    return card;
  }

  returnCardToTop(tier: TileTier, card: Card): void {
    this.decks[tier].addToTop(card);
  }

  peekTopCard(tier: TileTier): Card | undefined {
    const card = this.decks[tier].peekTop();

    // If deck is empty, reset it and peek again
    if (!card) {
      this.resetTierDecks(tier);
      return this.decks[tier].peekTop();
    }

    return card;
  }

  getDeckSize(tier: TileTier): number {
    return this.decks[tier].size();
  }

  // Trader deck methods
  getAvailableTraderCards(): TraderCard[] {
    return this.traderDeck.getCards();
  }

  removeTraderCard(itemId: string): boolean {
    return this.traderDeck.removeCard(itemId);
  }

  getTraderDeckSize(): number {
    return this.traderDeck.size();
  }
}

// Seeded random number generator for consistent results across server/client
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Create a seeded random instance for theme assignment
const themeRng = new SeededRandom(12345); // Fixed seed for consistency

// Helper function to deterministically assign a theme
function getRandomTheme(): AdventureThemeType {
  const themes: AdventureThemeType[] = ["beast", "cave", "grove"];
  return themes[Math.floor(themeRng.next() * themes.length)];
}

// Build the card deck
function buildCardDeck(includeDisabled: boolean = false): Card[] {
  const deck = new CardDeck();

  // Auto-generate monster cards from MONSTERS array
  MONSTER_CARDS.forEach((monster) => {
    if ((includeDisabled || !monster.disabled) && (!ONLY_INCLUDE_CARDS || ONLY_INCLUDE_CARDS.includes(monster.id))) {
      deck.addCard(monster.count, {
        type: "monster",
        tier: ONLY_INCLUDE_CARDS ? 1 : monster.tier,
        theme: monster.theme,
        id: monster.id,
      });
    }
  });

  // Auto-generate treasure cards from TREASURES array with theme from card or random
  TREASURE_CARDS.forEach((treasure) => {
    if ((includeDisabled || !treasure.disabled) && (!ONLY_INCLUDE_CARDS || ONLY_INCLUDE_CARDS.includes(treasure.id))) {
      for (let i = 0; i < treasure.count; i++) {
        deck.addToTop({
          type: "treasure",
          tier: ONLY_INCLUDE_CARDS ? 1 : treasure.tier,
          theme: treasure.theme || getRandomTheme(),
          id: treasure.id,
        });
      }
    }
  });

  // Auto-generate encounter cards from ENCOUNTERS array with theme from card or random
  ENCOUNTERS.forEach((encounter) => {
    if ((includeDisabled || !encounter.disabled) && (!ONLY_INCLUDE_CARDS || ONLY_INCLUDE_CARDS.includes(encounter.id))) {
      for (let i = 0; i < encounter.count; i++) {
        deck.addToTop({
          type: "encounter",
          tier: ONLY_INCLUDE_CARDS ? 1 : encounter.tier,
          theme: encounter.theme || getRandomTheme(),
          id: encounter.id,
        });
      }
    }
  });

  // Auto-generate event cards from EVENTS array with theme from card or random
  EVENT_CARDS.forEach((event) => {
    if ((includeDisabled || !event.disabled) && (!ONLY_INCLUDE_CARDS || ONLY_INCLUDE_CARDS.includes(event.id))) {
      for (let i = 0; i < event.count; i++) {
        deck.addToTop({
          type: "event",
          tier: ONLY_INCLUDE_CARDS ? 1 : event.tier,
          theme: event.theme || getRandomTheme(),
          id: event.id,
        });
      }
    }
  });

  return deck.getCards();
}

// Build the trader deck
function buildTraderDeck(includeDisabled: boolean = false): TraderCard[] {
  const deck = new TraderDeck();

  // Add the specified count of each trader item
  TRADER_ITEMS.forEach((trader) => {
    if (includeDisabled || !trader.disabled) {
      deck.addCard(trader.count, {
        type: "trader",
        id: trader.id,
      });
    }
  });

  return deck.getCards();
}

// Export the card deck and deck class
export const CARDS: Card[] = buildCardDeck(false); // Enabled cards only for gameplay
export const ALL_CARDS: Card[] = buildCardDeck(true); // All cards including disabled for UI
export const TRADER_CARDS: TraderCard[] = buildTraderDeck(false); // Enabled trader cards only for gameplay
export const ALL_TRADER_CARDS: TraderCard[] = buildTraderDeck(true); // All trader cards including disabled for UI
export { CardDeck, TraderDeck };

// Essential helper functions
export function getCardsByType(type: CardType): Card[] {
  return CARDS.filter((card) => card.type === type);
}

export function getCardsByTheme(theme: AdventureThemeType): Card[] {
  return CARDS.filter((card) => card.theme === theme);
}

export function getRandomTraderCard(): TraderCard {
  const randomIndex = Math.floor(Math.random() * TRADER_CARDS.length);
  return TRADER_CARDS[randomIndex];
}
