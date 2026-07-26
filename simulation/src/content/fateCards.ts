export type FateCardType = "council-yes-no" | "council-target" | "event" | "gathering" | "minor";

export interface FateCard {
  id: string;
  name: string;
  type: FateCardType;
  flavorText: string;
  effect: string;
}

// The first fate card of every game is predecided: during setup, place Settling face up on top of the deck
export const FIRST_FATE_CARD_ID = "settling";

export const FATE_CARDS: FateCard[] = [
  // Predecided first card
  {
    id: "settling",
    name: "Settling",
    type: "event",
    flavorText: "The lords arrive and stake their claims in peace... for now.",
    effect:
      "**No deliberate combat** this round: knights cannot move into a tile with another knight or a creature.\n*Always the first fate card of the game.*",
  },

  // Council Vote Cards - YES/NO
  {
    id: "tax-the-crown",
    name: "Tax the Crown",
    type: "council-yes-no",
    flavorText: "The lords convene to discuss the hoarding of wealth.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: the player with the most gold must pay 4 gold, distributing it among other players as they choose. If tied for most gold, all tied players pay 2 gold each.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "land-reform",
    name: "Land Reform",
    type: "council-yes-no",
    flavorText: "Whispers of inequality spread across the island.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: the player with the most resource tiles must give 1 tile (their choice, not home tile) to any player. If tied for most tiles, all tied players give a tile.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "charity-decree",
    name: "Charity Decree",
    type: "council-yes-no",
    flavorText: "The people demand aid for the struggling.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: each player (except those tied for fewest total resources) gives 1 resource of their choice to one of the players with the fewest total resources.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "famine",
    name: "Famine",
    type: "council-yes-no",
    flavorText: "The crops have withered. Should we ration?",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: no player may harvest this round.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "war-tax",
    name: "War Tax",
    type: "council-yes-no",
    flavorText: "Military buildup must be funded.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: every player with 3+ might must pay 2 gold or lose 1 might. Players with less than 3 might are unaffected.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "fame-reversal",
    name: "Fame Reversal",
    type: "council-yes-no",
    flavorText: "The mighty are humbled, the humble are lifted.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: the player with the most fame loses 2 fame, the player with the least fame gains 2 fame. If tied for most, all tied lose 2. If tied for least, all tied gain 2.\n**If tied or NO wins**: no effect.",
  },

  // Council Vote Cards - TARGET
  {
    id: "disarmament",
    name: "Disarmament",
    type: "council-target",
    flavorText: "The council calls for a show of restraint.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: the target with the most votes loses 2 might (minimum 0).\n**If targets are tied**: no one is affected.",
  },
  {
    id: "banishment",
    name: "Banishment",
    type: "council-target",
    flavorText: "The lords have grown weary of a rival's presence.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: all of the target's knights are sent home.\n**If targets are tied**: no one is affected.",
  },
  {
    id: "harvest-ban",
    name: "Harvest Ban",
    type: "council-target",
    flavorText: "The council targets a lord's economy.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: the target cannot harvest this round.\n**If targets are tied**: no one is affected.",
  },
  {
    id: "lockdown",
    name: "Lockdown",
    type: "council-target",
    flavorText: "The council restricts a lord's movements.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: the target cannot move any knights this round (boats and harvesting still allowed).\n**If targets are tied**: no one is affected.",
  },
  {
    id: "penalty",
    name: "Penalty",
    type: "council-target",
    flavorText: "The council imposes a burden.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: the target rolls one fewer die this round (minimum 1).\n**If targets are tied**: no one is affected.",
  },
  {
    id: "royal-honor",
    name: "Royal Honor",
    type: "council-target",
    flavorText: "The council bestows its highest honor.",
    effect:
      "**Council vote**: each player votes for a target player (fame = vote weight).\n**Result**: the target with the most votes gains 2 fame.\n**If targets are tied**: no one is honored.",
  },

  // Gathering Cards
  {
    id: "festival",
    name: "Festival",
    type: "gathering",
    flavorText: "A grand festival is held at the trader's bazaar!",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: all knights move to the Trader tile. Each player may make one free trade at 1:1 rate. Knights stay at the Trader until moved next round.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "grand-tourney",
    name: "Grand Tourney",
    type: "gathering",
    flavorText: "The lords are called to prove their strength!",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: all knights move to the Mercenary Camp. All players roll 1D3 - highest roller gains 1 might (ties reroll). Knights stay until moved next round.\n**If tied or NO wins**: no effect.",
  },
  {
    id: "prayer-day",
    name: "Prayer Day",
    type: "gathering",
    flavorText: "The faithful gather to seek divine guidance.",
    effect:
      "**Council vote**: each player votes YES or NO (fame = vote weight).\n**If YES wins**: all knights move to the Temple. All players gain 1 fame. Knights stay at the Temple until moved next round.\n**If tied or NO wins**: no effect.",
  },

  // Event Cards
  {
    id: "bountiful-harvest",
    name: "Bountiful Harvest",
    type: "event",
    flavorText: "The land yields abundantly this season.",
    effect: "All harvests produce **double resources** this round.",
  },
  {
    id: "ceasefire",
    name: "Ceasefire",
    type: "event",
    flavorText: "An uneasy peace settles over the island.",
    effect: "**No PVP combat** this round. Knights may pass through each other freely without being stopped.",
  },
  {
    id: "fog-of-war",
    name: "Fog of War",
    type: "event",
    flavorText: "A thick fog blankets the coastline.",
    effect: "**No boat movement** or transport this round.",
  },
  {
    id: "dragons-shadow",
    name: "Dragon's Shadow",
    type: "event",
    flavorText: "The dragon circles the island, casting fear.",
    effect:
      "All knights **in the hills or mountains** must flee to their home tile. Knights already at Doomspire are unaffected.",
  },
  {
    id: "oasis-bloom",
    name: "Oasis Bloom",
    type: "event",
    flavorText: "Springs bubble up from the earth.",
    effect: "All oasis tiles gain **+1 adventure token**.",
  },
  {
    id: "storm-season",
    name: "Storm Season",
    type: "event",
    flavorText: "Fierce storms batter the coast.",
    effect:
      "All boats are pushed: move each boat **1 ocean zone clockwise**. Boats cannot transport knights this round.",
  },
  {
    id: "merchant-fair",
    name: "Merchant Fair",
    type: "event",
    flavorText: "Traveling merchants flood the markets.",
    effect:
      "All trader exchanges are **1:1** instead of 2:1 this round. All building costs are reduced by 1 of each resource type (minimum 1 each).",
  },
  {
    id: "dragon-sleeping",
    name: "Dragon Sleeping",
    type: "event",
    flavorText: "The dragon slumbers deeply, snoring like thunder.",
    effect:
      "The dragon can **only be impressed by combat** this round (not fame, gold, economy, or rings). However, the sleeping dragon's might is **reduced by 2**.",
  },
  {
    id: "dragon-off-hunting",
    name: "Dragon Off Hunting",
    type: "event",
    flavorText: "The dragon has left Doomspire to hunt in distant lands.",
    effect:
      "The dragon is **absent** this round. Knights at Doomspire cannot impress the dragon, but may **take a treasure stack** (if any remain). Normal PVP rules apply - if multiple players want treasure, they'll have to fight for it.",
  },
  {
    id: "prosperous-crops",
    name: "Prosperous Crops",
    type: "event",
    flavorText: "The granaries overflow with the season's bounty.",
    effect: "**No dice tax** this round: all dice beyond the first two are free.",
  },
  {
    id: "lean-times",
    name: "Lean Times",
    type: "event",
    flavorText: "A hard season leaves the storehouses thin.",
    effect: "The **dice tax is 3 food** per extra die this round (instead of 2).",
  },
  {
    id: "trade-boom",
    name: "Trade Boom",
    type: "event",
    flavorText: "Demand surges in the markets across the sea.",
    effect: "All **Markets** sell resources at **1:1** instead of 2:1 this round.",
  },
  {
    id: "dragon-gifts",
    name: "Dragon Gifts",
    type: "event",
    flavorText: "The dragon rewards those who amuse it.",
    effect:
      "The player with the **most fame** gains 3 resources of their choice, the **second most** gains 2, everyone else gains 1. Tied players share the higher reward.",
  },
  {
    id: "beasts-are-stirring",
    name: "Beasts Are Stirring",
    type: "event",
    flavorText: "Something growls in the empty dens.",
    effect:
      "In turn order, each player **may place a beast** on an empty den: a *wolf* in the flatlands, a *bear* in the hills.",
  },

  // Minor Cards
  {
    id: "favorable-winds",
    name: "Favorable Winds",
    type: "minor",
    flavorText: "A gentle breeze fills the sails.",
    effect: "All boat movements get **+1 step** this round.",
  },
  {
    id: "the-gift",
    name: "The Gift",
    type: "minor",
    flavorText: "A gesture of goodwill... or obligation.",
    effect:
      "Starting from the player with the **most fame**, each player passes 1 resource of their choice to the player on their left. Continue clockwise until all players have given and received.",
  },
  {
    id: "fortune-smiles",
    name: "Fortune Smiles",
    type: "minor",
    flavorText: "Luck favors the desperate.",
    effect: "The player with the **fewest total resources** gains 3 resources of their choice.",
  },
  {
    id: "tailwind",
    name: "Tailwind",
    type: "minor",
    flavorText: "A steady wind pushes at every knight's back.",
    effect:
      "Each **knight movement** gets **+1 step** this round. Applies once per movement: a sprint combining multiple dice still gains only +1 step.",
  },
  {
    id: "bounty",
    name: "Bounty",
    type: "minor",
    flavorText: "The council pays well for pest control.",
    effect: "Defeating a **monster** grants **+1 fame** this round.",
  },
  {
    id: "homesteading",
    name: "Homesteading",
    type: "minor",
    flavorText: "Settlers flock to whoever plants a banner.",
    effect: "**Claiming a resource tile** grants **+1 fame** this round.",
  },
  {
    id: "cartographers-prize",
    name: "Cartographer's Prize",
    type: "minor",
    flavorText: "The guild pays handsomely for new maps.",
    effect: "**Exploring a tile** grants **+1 extra fame** this round (2 fame total per tile).",
  },
];
