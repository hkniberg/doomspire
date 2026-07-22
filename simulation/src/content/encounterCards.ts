import { AdventureThemeType, TileTier } from "../lib/types";

export interface Encounter {
  id: string;
  name: string;
  tier: TileTier;
  description: string;
  follower: boolean; // Whether this encounter can become a follower
  count: number; // How many cards of this encounter to include in deck
  disabled?: boolean; // If true, card is not added to deck but still shown in UI
  imagePromptGuidance?: string; // If provided, this will be used to generate the image for the card
  theme?: AdventureThemeType;
}

// All encounter cards in the game
export const ENCOUNTERS: Encounter[] = [
  // Tier 1 Encounter Cards
  {
    id: "angry-dog",
    name: "Angry dog",
    tier: 1,
    description: "Give it `2 food`: the dog joins as a **follower** and grants `+1 might`in battle. If you can't feed it, you are **chased home**.",
    follower: true,
    count: 1,
    theme: "beast",
  },
  {
    disabled: true,
    id: "old-beggar",
    name: "Old beggar",
    tier: 1,
    description: 'Refuses to leave until you pay him `1 gold`. Can be **passed** to any *knight* you walk through or share a tile with',
    follower: true,
    count: 1,
    theme: "beast",
  },
  {
    id: "priestess",
    name: "Priestess",
    tier: 1,
    description: "**Heals** you for *free* if you lose a fight against any wild creature.",
    follower: true,
    count: 1,
    theme: "cave",
  },
  {
    id: "abandoned-mule",
    name: "Abandoned Mule",
    tier: 1,
    description: "Limits your movement to max `2` per action die. The mule can carry `2 items`.",
    follower: true,
    count: 1,
    theme: "grove",
  },
  {
    id: "fairy-godmother",
    name: "Fairy godmother",
    tier: 1,
    description: "Every time your *champion* supports another player in battle, you get `1 fame`.",
    follower: true,
    count: 1,
    theme: "grove",
  },


  // Tier 2 Encounter Cards
  {
    id: "proud-mercenary",
    name: "Proud Mercenary",
    tier: 2,
    description: "Each **combat** you may pay `3x gold` and gain temporary `+2 might`.",
    follower: true,
    count: 1,
    theme: "beast",
  },
  {
    id: "brawler",
    name: "Brawler",
    tier: 2,
    description: "Each **combat** you may feed him `3x food` and gain temporary `+2 might`.",
    follower: true,
    count: 1,
    theme: "cave",
  },
  {
    id: "witch",
    name: "Witch",
    tier: 2,
    description: `The witch will always attempt to aid you in combat with her magic. Roll 1D3 after your dice.
**(1)** \`-1 might\`  
**(2)** \`+1 might\`  
**(3)** \`+2 might\``,
    follower: true,
    count: 1,
    theme: "grove",
  },

  // Tier 3 Encounter Cards
  {
    id: "wandering-monk",
    name: "Wandering monk",
    tier: 3,
    description: "Wololoo! You may take over another player's **resource tile** (not home tile).",
    follower: false,
    imagePromptGuidance: "White robe, blue stripe, and cane, like an Age of Empires monk",
    count: 1,
    theme: "beast",
  },
];

// Helper function to get encounter by name
export function getEncounterByName(name: string): Encounter | undefined {
  return ENCOUNTERS.find((encounter) => encounter.name === name);
}

// Helper function to get encounter by id
export function getEncounterById(id: string): Encounter | undefined {
  return ENCOUNTERS.find((encounter) => encounter.id === id);
}

// Helper function to get all encounters by tier
export function getEncountersByTier(tier: TileTier): Encounter[] {
  return ENCOUNTERS.filter((encounter) => encounter.tier === tier);
}

// Helper function to get all follower encounters
export function getFollowerEncounters(): Encounter[] {
  return ENCOUNTERS.filter((encounter) => encounter.follower);
}
