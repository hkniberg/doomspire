// Lords of Doomspire Game Settings
// Contains all configurable game balance parameters

export class GameSettings {
  // Dragon Combat Settings
  static readonly DRAGON_BASE_MIGHT = 8; // Base might before adding D3

  // Victory Condition Settings
  static readonly VICTORY_FAME_THRESHOLD = 17; // Fame needed to impress the dragon
  static readonly VICTORY_GOLD_THRESHOLD = 12; // Gold needed to impress the dragon
  static readonly VICTORY_STARRED_TILES_THRESHOLD = 4; // Number of starred resource tiles needed to win
  static readonly DRAGON_IMPRESSIONS_TO_WIN = 2; // Number of dragon impressions needed to win the game

  static readonly FAME_AWARD_FOR_EXPLORATION = 1; // Fame awarded for exploring a tile group

  // Dice System Settings
  static readonly FREE_DICE_COUNT = 2; // Number of dice you can roll for free each turn
  static readonly DICE_TAX_FOOD_PER_DIE = 2; // Food cost per extra die beyond free dice

  // Building Construction Costs
  static readonly BLACKSMITH_COST = { food: 2, wood: 0, ore: 2, gold: 0 };
  static readonly MARKET_COST = { food: 2, wood: 2, ore: 0, gold: 0 };
  static readonly FLETCHER_COST = { food: 1, wood: 1, ore: 1, gold: 1 };
  static readonly CHAPEL_COST = { food: 0, wood: 6, ore: 0, gold: 2 };
  static readonly MONASTERY_COST = { food: 0, wood: 8, ore: 1, gold: 3 }; // Upgrade from chapel
  static readonly WARSHIP_UPGRADE_COST = { food: 0, wood: 2, ore: 1, gold: 1 };
  static readonly BOAT_COST = { food: 0, wood: 2, ore: 0, gold: 2 };

  // Champion Recruitment Costs (as per game rules: always 3 Food, 3 Gold, 1 Ore)
  static readonly CHAMPION_COST = { food: 3, wood: 0, ore: 1, gold: 3 };

  // Maximum Units
  static readonly MAX_CHAMPIONS_PER_PLAYER = 3; // Maximum number of champions per player
  static readonly MAX_BOATS_PER_PLAYER = 2; // Maximum number of boats per player

  // Building Usage Costs
  static readonly BLACKSMITH_USAGE_COST = { food: 0, wood: 0, ore: 3, gold: 1 }; // To gain 1 might
  static readonly FLETCHER_USAGE_COST = { food: 0, wood: 3, ore: 1, gold: 0 }; // To gain 1 might

  // Special Location Costs
  static readonly TEMPLE_FAME_COST = 2; // Fame cost to gain 1 might at temple
  static readonly MERCENARY_GOLD_COST = 3; // Gold cost to gain 1 might at mercenary camp

  // Construction Rewards
  static readonly CHAPEL_FAME_REWARD = 3; // Fame gained when building chapel
  static readonly MONASTERY_FAME_REWARD = 5; // Fame gained when upgrading to monastery

  // Combat Rewards and Penalties
  static readonly CHAMPION_VS_CHAMPION_FAME_AWARD = 1; // Fame gained for winning champion vs champion combat
  static readonly DEFEAT_FAME_PENALTY = 1; // Fame lost when defeated with no resources to pay healing costs
  static readonly COMBAT_SUPPORT_BONUS = 2; // Might bonus per supporting unit (knight or warship) in combat

  // Tile Interaction Costs
  static readonly CONQUEST_MIGHT_COST = 1; // Might cost to conquer a tile
  static readonly REVOLT_FAME_COST = 1; // Fame cost to incite revolt

  // Might Rewards
  static readonly MERCENARY_MIGHT_REWARD = 1; // Might gained from mercenary camp
  static readonly TEMPLE_MIGHT_REWARD = 1; // Might gained from temple

  // Resource Trading
  static readonly TRADER_EXCHANGE_RATE = 2; // Resources needed to get 1 of another type
  static readonly MARKET_EXCHANGE_RATE = 2; // Resources needed to get 1 gold at market
} 