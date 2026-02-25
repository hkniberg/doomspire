import { AdventureThemeType, TileTier } from "../lib/types";

export interface TreasureCard {
  id: string;
  name: string;
  tier: TileTier;
  description: string;
  count: number; // How many cards of this treasure to include in deck
  carriable: boolean; // Whether this treasure can be carried as an item
  disabled?: boolean; // If true, card is not added to deck but still shown in UI
  imagePromptGuidance?: string; // If provided, this will be used to generate the image for the card
  theme?: AdventureThemeType;
}

export function getTreasureCardById(id: string): TreasureCard | undefined {
  return TREASURE_CARDS.find((treasure) => treasure.id === id);
}

// All treasure cards in the game
export const TREASURE_CARDS: TreasureCard[] = [
  // Tier 1 Treasure Cards
  {
    id: "broken-shield",
    name: "Broken Shield",
    tier: 1,
    description: `Choose one:
Gain \`+1 ore\`, **OR**
Spend \`2 ore\` to gain \`+1 might\``,
    count: 2,
    carriable: false,
    theme: "beast"
  },
  {
    id: "rusty-sword",
    name: "Rusty sword",
    tier: 1,
    description: "Gain `+2 might` for this battle. This **item breaks** after *one use*.",
    count: 2,
    carriable: true,
    theme: "grove"
  },
  {
    id: "trollsbane",
    name: "Trollsbane",
    tier: 1,
    description: "A cursed axe, forged with fury towards `trolls`and their ilk. When fighting one, you may pay `-1 fame` to gain `+2 might`for this battle.",
    count: 1,
    carriable: true,
    theme: "cave"
  },
  {
    id: "mysterious-ring",
    name: "Mysterious Ring",
    tier: 1,
    description: `Roll \`1d3\`:
**(1)** The ring does nothing and is *stuck* on your knight untill you visit the **temple**.
**(2)** **Swap** location with any knight, then the ring breaks.
**(3)** \`+3 might\` against **dragons**`,
    count: 1,
    carriable: true,
    theme: "cave"
  },

  // Tier 2 Treasure Cards
  {
    id: "long-sword",
    name: "Löng Swörd",
    tier: 2,
    description: "It's a **löng swörd**. Gives `+2 might`, but takes up `2x item slots`.",
    count: 2,
    carriable: true,
    theme: "cave",
    imagePromptGuidance: "Make it long, to distinguish it from a short sword.",
  },
  {
    id: "porcupine",
    name: "Porcupine",
    tier: 2,
    description: "If the opponent has **more might**, this *shield* grants `+2 might`.",
    count: 1,
    carriable: true,
    theme: "grove",
    imagePromptGuidance: "A spiky shield, not the animal",
  },
  {
    id: "sword-in-stone",
    name: "Sword in a stone",
    tier: 2,
    description: `Attempt to pull the sword! Roll \`2x D3\`:
**(2)** It breaks off. You get **half a sword** which gives \`+2 might\`
**(3-5)** The Card remains on this tile until the sword has been pulled out.
**(6)** You gain **Cloudslicer** which gives \`+4 might\``,
    count: 1,
    theme: "beast",
    carriable: false, // This stays on the tile until someone pulls it out
  },
  {
    id: "staff-of-protection",
    name: "Staff of protection",
    tier: 2,
    description: `You encounter a dying wizard leaning on an interesting looking staff. Choose one:
**(1)** Steal it (lose \`2 fame\`). The staff protects all neighbouring tiles, even diagonally.
**(2)** Give him \`2 food\` (earn \`1 fame\`)
**(3)** Move on`,
    count: 1,
    theme: "cave",
    carriable: true,
  },

  // Tier 3 Treasure Cards
  {
    id: "the-one-ring",
    name: "The one ring",
    tier: 3,
    description: "Grants `+2 might`. Any *knight* with both the *one* and the *second* ring, may **exile the dragon** as if they had reached one of the four win-conditions. If you also possess *the mysterious ring* while doing so, **the game immediately ends** as you absorb the dragons essence and take its place as the new ruler.",
    count: 1,
    carriable: true,
    theme: "cave"
  },
  {
    id: "the-second-ring",
    name: "The second ring",
    tier: 3,
    description: "Gives `+2 fame`. Any *knight* with both the *one* and the *second* ring, may **exile the dragon** as if they had reached one of the four win-conditions. If you also posess *the mysterious ring* while doing so, **the game immediately ends** as you absorb the dragons essence and take its place as the new ruler.",
    count: 1,
    carriable: true,
    theme: "grove"
  },
  {
    id: "the-black-blade",
    name: "The black blade",
    tier: 3,
    description: "Fight a ghostly knight (Might 7). If you win, the knight disappears with a shriek, leaving an ominous black blade on the ground. *The black blade:* Grants `-1 might`. Each battle you may sacrifice a *follower* to temporarily gain`+5 might`. (If this blade swaps owner the ghostly knight re-emerges).",
    count: 1,
    carriable: true,
    theme: "beast"
  },

];
