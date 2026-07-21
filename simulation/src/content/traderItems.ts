export interface TraderItem {
  id: string;
  name: string;
  description: string;
  cost: number; // Cost in gold to purchase from trader
  count: number; // How many cards of this trader item to include in deck
  disabled?: boolean; // If true, card is not added to deck but still shown in UI
  imagePromptGuidance?: string; // If provided, this will be used to generate the image for the card
}

export function getTraderItemById(id: string): TraderItem | undefined {
  return TRADER_ITEMS.find((item) => item.id === id);
}

// All trader items available for purchase
export const TRADER_ITEMS: TraderItem[] = [
  {
    id: "spear",
    name: "Spear",
    description: "Gain `+1 might` when fighting **beasts**.",
    cost: 1,
    count: 2,
  },
  {
    id: "backpack",
    name: "Backpack",
    description: "Gives you 2 extra item slots (although this backpack occupies one of them). The backpack cannot be stolen.",
    cost: 1,
    count: 2,
  },
  {
    id: "padded-helmet",
    name: "Padded Helmet",
    description: "If you lose a battle against another knight, you choose what they loot from you.",
    cost: 1,
    count: 2,
    imagePromptGuidance: "Simple medieval leather helmet",
  },
  {
    id: "the-hedgehog",
    name: "The Hedgehog",
    description: "When battling another player, if their **combat total** is higher than yours (dice, might, support, and items all count), you have `+1 might` for that fight.",
    cost: 1,
    count: 2,
  },
  {
    // Disabled in the simulator: attacking a neighboring tile without moving is not supported by the engine
    disabled: true,
    id: "ellions-bow",
    name: "Ellion's bow",
    description: "You may initiate an attack on a neighboring tile as if you were there.",
    cost: 3,
    count: 1,
    imagePromptGuidance: "A fancy looking longbow",
  },
  {
    id: "robe-of-the-salamander",
    name: "Robe of the Salamander",
    description: "Each battle you may burn `3x wood` for `+2 might`.",
    cost: 3,
    count: 1,
  },
]; 
