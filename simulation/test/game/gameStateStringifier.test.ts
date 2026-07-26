import { getTraderItemById } from "@/content/traderItems";
import { getTreasureCardById } from "@/content/treasureCards";
import { GameState } from "../../src/game/GameState";
import { stringifyGameState, stringifyTileForGameLog } from "../../src/game/gameStateStringifier";
import { Board } from "../../src/lib/Board";
import type { Player, Position, Tile } from "../../src/lib/types";

describe("GameStateStringifier", () => {
  test("should stringify game state to match expected markdown format", () => {
    const sampleGameState = createSampleGameState();
    const result = stringifyGameState(sampleGameState);

    const expected = `# Game session
- Current round: 2
- Current player: Jim

# Players

## Jim
- Might: 0
- Fame: 3
- Dragon impressions: 0/2
- Home: (0,7)
- Resource stockpile: 1 food, 2 wood
- champion1 at (3,3)
  - Has Broken Shield (broken-shield) - Choose one:
Gain \`+1 ore\`, **OR**
Spend \`2 ore\` to gain \`+1 might\`
  - Has Rusty sword (rusty-sword) - Gain \`+2 might\` for this battle. This **item breaks** after *one use*.
- champion2 at (3,5)
- champion1 at (2,5)
- boat1 at (sw)
- Buildings: none
- claims (2 tiles):
  - Tile (0,5) (starred) providing 2 food, 1 gold (blockaded by Bob champion1)
  - Tile (0,7) providing 1 ore

## Bob
- Might: 1
- Fame: 2
- Dragon impressions: 0/2
- Home: (0,0)
- Resource stockpile: 1 ore
- champion1 at (0,5)
- boat1 at (ne)
- boat2 at (se)
- Buildings: none
- no claims

## Alice
- Might: 0
- Fame: 0
- Dragon impressions: 0/2
- Home: (7,0)
- Resource stockpile: 1 food, 1 wood
- champion1 at (7,0)
- boat1 at (sw)
- Buildings:
  - market (sell any resources for gold at 2:1 during the harvest phase, resources can be pooled)
  - blacksmith (buy 1 might for 1 gold + 3 ore, once per harvest phase)
- no claims

## David
- Might: 0
- Fame: 0
- Dragon impressions: 0/2
- Home: (7,7)
- Resource stockpile: 1 food, 1 wood
- champion1 at (7,7)
- boat1 at (se)
- Buildings: none
- no claims

# Board

Tile (0,0)
- Home tile for Bob (can ONLY be entered by Bob's champions)

Tile (0,1)
- Unexplored tier 1 tile

Tile (0,2)
- Unexplored tier 1 tile

Tile (0,3)
- Unexplored tier 1 tile

Tile (0,4)
- Unexplored tier 1 tile

Tile (0,5)
- Starred Resource tile providing 2 food, 1 gold
- Claimed by Jim
- Bob champion1 is here, blockading

Tile (0,6)
- Unexplored tier 1 tile

Tile (0,7)
- Resource tile providing 1 ore
- Claimed by Jim

Tile (1,0)
- Unexplored tier 1 tile

Tile (1,1)
- Unexplored tier 1 tile

Tile (1,2)
- Unexplored tier 1 tile

Tile (1,3)
- Unexplored tier 1 tile

Tile (1,4)
- Unexplored tier 1 tile

Tile (1,5)
- Unexplored tier 1 tile

Tile (1,6)
- Tier 1 adventure tile (0 cards left)
- Monster: bandit (might 3) (reward 1 fame, 3 gold)

Tile (1,7)
- Unexplored tier 1 tile

Tile (2,0)
- Unexplored tier 1 tile

Tile (2,1)
- Unexplored tier 1 tile

Tile (2,2)
- Unexplored tier 1 tile

Tile (2,3)
- Unexplored tier 1 tile

Tile (2,4)
- Unexplored tier 1 tile

Tile (2,5)
- Tier 2 adventure tile (2 cards left)
- Jim champion1 is here

Tile (2,6)
- Unclaimed Resource tile providing 1 wood
- Monster: wolf (beast) (might 6) (reward 1 fame, 2 food)

Tile (2,7)
- Unexplored tier 2 tile

Tile (3,0)
- Unexplored tier 1 tile

Tile (3,1)
- Unexplored tier 1 tile

Tile (3,2)
- Unexplored tier 1 tile

Tile (3,3)
- Unexplored tier 1 tile
- Jim champion1 is here

Tile (3,4)
- Unexplored tier 1 tile

Tile (3,5)
- Temple (no combat). Sacrifice 2 fame to gain 1 might (once per round)
- Jim champion2 is here

Tile (3,6)
- Trader (no combat). Exchange 2 of any resource (food/wood/ore/gold) for 1 of any resource. Buy weapons/tools/items for gold. Once per round
- Item: spear (dropped on ground)

Tile (3,7)
- Mercenary camp (no combat). Buy 1 might for 3 gold (once per round)

Tile (4,0)
- Unexplored tier 1 tile

Tile (4,1)
- Unexplored tier 1 tile

Tile (4,2)
- Unexplored tier 1 tile

Tile (4,3)
- Unexplored tier 1 tile

Tile (4,4)
- Doomspire Dragon (might 8 + 2D3). Impress it (17+ fame, 12+ gold, 4+ starred tiles, or defeat it in combat) or be eaten. First player to impress it 2 times wins

Tile (4,5)
- Unexplored tier 1 tile

Tile (4,6)
- Unexplored tier 1 tile

Tile (4,7)
- Unexplored tier 1 tile

Tile (5,0)
- Unexplored tier 1 tile

Tile (5,1)
- Unexplored tier 1 tile

Tile (5,2)
- Unexplored tier 1 tile

Tile (5,3)
- Unexplored tier 1 tile

Tile (5,4)
- Unexplored tier 1 tile

Tile (5,5)
- Unexplored tier 1 tile

Tile (5,6)
- Unexplored tier 1 tile

Tile (5,7)
- Unexplored tier 1 tile

Tile (6,0)
- Unexplored tier 1 tile

Tile (6,1)
- Unexplored tier 1 tile

Tile (6,2)
- Unexplored tier 1 tile

Tile (6,3)
- Unexplored tier 1 tile

Tile (6,4)
- Unexplored tier 1 tile

Tile (6,5)
- Unexplored tier 1 tile

Tile (6,6)
- Unexplored tier 1 tile

Tile (6,7)
- Unexplored tier 1 tile

Tile (7,0)
- Home tile for Alice (can ONLY be entered by Alice's champions)
- Alice champion1 is here

Tile (7,1)
- Unexplored tier 1 tile

Tile (7,2)
- Unexplored tier 1 tile

Tile (7,3)
- Unexplored tier 1 tile

Tile (7,4)
- Unexplored tier 1 tile

Tile (7,5)
- Unexplored tier 1 tile

Tile (7,6)
- Unexplored tier 1 tile

Tile (7,7)
- Home tile for David (can ONLY be entered by David's champions)
- David champion1 is here`;

    expect(result).toBe(expected);
  });

  test("should stringify individual tiles for game log with complex scenarios", () => {
    const sampleGameState = createSampleGameState();

    // Test 1: Blockaded starred resource tile with opposing champion
    const blockadedTile = sampleGameState.getTile({ row: 0, col: 5 })!;
    const blockadedResult = stringifyTileForGameLog(blockadedTile, sampleGameState);
    expect(blockadedResult).toBe("This is a resource tile (2 food, 1 gold) (starred) owned by Jim. Bob champion1 is here.");

    // Test 2: Resource tile with monster, unclaimed
    const monsterTile = sampleGameState.getTile({ row: 2, col: 6 })!;
    const monsterResult = stringifyTileForGameLog(monsterTile, sampleGameState);
    expect(monsterResult).toBe("This is a resource tile (1 wood). There is a wolf (beast) (might 6) (reward 1 fame, 2 food) here.");

    // Test 3: Trader tile with dropped item
    const traderTile = sampleGameState.getTile({ row: 3, col: 6 })!;
    const traderResult = stringifyTileForGameLog(traderTile, sampleGameState);
    expect(traderResult).toBe("This is a trader (no combat). Exchange 2 of any resource (food/wood/ore/gold) for 1 of any resource. Buy weapons/tools/items for gold. Once per round. There is a spear here.");

    // Test 4: Adventure tile with monster and no tokens
    const adventureTile = sampleGameState.getTile({ row: 1, col: 6 })!;
    const adventureResult = stringifyTileForGameLog(adventureTile, sampleGameState);
    expect(adventureResult).toBe("This is a tier 1 adventure tile (0 cards left). There is a bandit (might 3) (reward 1 fame, 3 gold) here.");

    // Test 4b: Adventure tile with remaining tokens
    const adventureTileWithTokens = sampleGameState.getTile({ row: 2, col: 5 })!;
    const adventureWithTokensResult = stringifyTileForGameLog(adventureTileWithTokens, sampleGameState, "Jim");
    expect(adventureWithTokensResult).toBe("This is a tier 2 adventure tile (2 cards left).");

    // Test 5: Temple with champion
    const templeTile = sampleGameState.getTile({ row: 3, col: 5 })!;
    const templeResult = stringifyTileForGameLog(templeTile, sampleGameState, "Jim"); // Ignore Jim's champion
    expect(templeResult).toBe("This is a temple (no combat). Sacrifice 2 fame to gain 1 might (once per round).");

    // Test 6: Protected resource tile (protected by adjacent champion)
    // Add a Jim champion adjacent to his claimed tile at (0,7) to protect it
    const jimPlayer = sampleGameState.getPlayer("Jim")!;
    jimPlayer.champions.push({
      id: 3,
      position: { row: 0, col: 6 }, // Adjacent to (0,7) to protect it
      playerName: "Jim",
      items: [],
      followers: [],
    });

    const protectedTile = sampleGameState.getTile({ row: 0, col: 7 })!;
    const protectedResult = stringifyTileForGameLog(protectedTile, sampleGameState);
    expect(protectedResult).toBe("This is a resource tile (1 ore) owned by Jim (protected).");
  });
});

function createSampleGameState(): GameState {
  // Create the board
  const board = new Board(8, 8);

  // Get item data for creating CarriableItem objects
  const brokenShield = getTreasureCardById("broken-shield")!;
  const rustySword = getTreasureCardById("rusty-sword")!;
  const spear = getTraderItemById("spear")!;

  // Initialize all tiles
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      board.setTile(createBasicTile(row, col));
    }
  }

  // Set up specific tiles from the example
  // Tile (0,5) - Resource tile, starred, claimed by Jim, with Bob champion1
  board.setTile({
    position: { row: 0, col: 5 },
    tier: 1,
    explored: true,
    tileType: "resource",
    resources: { food: 2, wood: 0, ore: 0, gold: 1 },
    isStarred: true,
    claimedBy: "Jim",
  });

  // Tile (0,7) - Resource tile, claimed by Jim, with Jim champion1
  board.setTile({
    position: { row: 0, col: 7 },
    tier: 1,
    explored: true,
    tileType: "resource",
    resources: { food: 0, wood: 0, ore: 1, gold: 0 },
    claimedBy: "Jim",
  });

  // Tile (2,6) - Resource tile with monster
  board.setTile({
    position: { row: 2, col: 6 },
    tier: 1,
    explored: true,
    tileType: "resource",
    resources: { food: 0, wood: 1, ore: 0, gold: 0 },
    monster: {
      id: "wolf",
      name: "wolf",
      tier: 1,
      icon: "🐺",
      might: 6,
      fame: 1,
      resources: { food: 2, wood: 0, ore: 0, gold: 0 },
      monsterType: "beast",
    },
  });

  // Tile (2,7) - Unexplored tier 2 tile
  board.setTile({
    position: { row: 2, col: 7 },
    tier: 2,
    explored: false,
  });

  // Tile (2,5) - Adventure tile with tokens, Jim champion1 (moved from 2,8 to 2,5 to stay in bounds)
  board.setTile({
    position: { row: 2, col: 5 },
    tier: 2,
    explored: true,
    tileType: "adventure",
    adventureTokens: 2,
  });

  // Tile (1,6) - Adventure tile with monster (moved from 1,8 to 1,6 to stay in bounds)
  board.setTile({
    position: { row: 1, col: 6 },
    tier: 1,
    explored: true,
    tileType: "adventure",
    adventureTokens: 0,
    monster: {
      id: "bandit",
      name: "bandit",
      tier: 1,
      icon: "🗡️",
      might: 3,
      fame: 1,
      resources: { food: 0, wood: 0, ore: 0, gold: 3 },
    },
  });

  // Tile (4,4) - Doomspire
  board.setTile({
    position: { row: 4, col: 4 },
    tier: 3,
    explored: true,
    tileType: "doomspire",
  });

  // Tile (3,5) - Chapel, Jim champion2
  board.setTile({
    position: { row: 3, col: 5 },
    tier: 1,
    explored: true,
    tileType: "temple",
  });

  // Tile (3,6) - Trader
  board.setTile({
    position: { row: 3, col: 6 },
    tier: 1,
    explored: true,
    tileType: "trader",
    items: [
      {
        traderItem: spear,
      },
    ],
  });

  // Tile (3,7) - Mercenary
  board.setTile({
    position: { row: 3, col: 7 },
    tier: 1,
    explored: true,
    tileType: "mercenary",
  });

  // Create players
  const players: Player[] = [
    {
      name: "Jim",
      color: "#0000FF",
      fame: 3,
      might: 0,
      resources: { food: 1, wood: 2, ore: 0, gold: 0 },
      dragonImpressions: 0,
      homePosition: { row: 0, col: 7 },
      champions: [
        {
          id: 1,
          position: { row: 3, col: 3 },
          playerName: "Jim",
          items: [
            {
              treasureCard: brokenShield,
            },
            {
              treasureCard: rustySword,
            },
          ],
          followers: [],
        },
        {
          id: 2,
          position: { row: 3, col: 5 },
          playerName: "Jim",
          items: [],
          followers: [],
        },
      ],
      boats: [
        {
          id: 1,
          playerName: "Jim",
          position: "sw",
        },
      ],
      buildings: [],
    },
    {
      name: "Bob",
      color: "#FF0000",
      fame: 2,
      might: 1,
      resources: { food: 0, wood: 0, ore: 1, gold: 0 },
      dragonImpressions: 0,
      homePosition: { row: 0, col: 0 },
      champions: [
        {
          id: 1,
          position: { row: 0, col: 5 },
          playerName: "Bob",
          items: [],
          followers: [],
        },
      ],
      boats: [
        {
          id: 1,
          playerName: "Bob",
          position: "ne",
        },
        {
          id: 2,
          playerName: "Bob",
          position: "se",
        },
      ],
      buildings: [],
    },
    {
      name: "Alice",
      color: "#00FF00",
      fame: 0,
      might: 0,
      resources: { food: 1, wood: 1, ore: 0, gold: 0 },
      dragonImpressions: 0,
      homePosition: { row: 7, col: 0 },
      champions: [
        {
          id: 1,
          position: { row: 7, col: 0 },
          playerName: "Alice",
          items: [],
          followers: [],
        },
      ],
      boats: [
        {
          id: 1,
          playerName: "Alice",
          position: "sw",
        },
      ],
      buildings: ["market", "blacksmith"],

    },
    {
      name: "David",
      color: "#FFFF00",
      fame: 0,
      might: 0,
      resources: { food: 1, wood: 1, ore: 0, gold: 0 },
      dragonImpressions: 0,
      homePosition: { row: 7, col: 7 },
      champions: [
        {
          id: 1,
          position: { row: 7, col: 7 },
          playerName: "David",
          items: [],
          followers: [],
        },
      ],
      boats: [
        {
          id: 1,
          playerName: "David",
          position: "se",
        },
      ],
      buildings: [],

    },
  ];

  // Also add a champion at (2,5) for Jim
  players[0].champions.push({
    id: 1, // This will be confusing with multiple champion1s, but it matches the example
    position: { row: 2, col: 5 },
    playerName: "Jim",
    items: [],
    followers: [],
  });

  return new GameState(
    board,
    players,
    0, // Jim is current player (index 0)
    2, // Round 2
  );
}

function createBasicTile(row: number, col: number): Tile {
  const position: Position = { row, col };

  // Set home tiles
  if ((row === 0 && col === 0) || (row === 0 && col === 7) || (row === 7 && col === 0) || (row === 7 && col === 7)) {
    return {
      position,
      tier: 1,
      explored: true,
      tileType: "home",
    };
  }

  // Default to unexplored tier 1 tiles
  return {
    position,
    tier: 1,
    explored: false,
  };
}
