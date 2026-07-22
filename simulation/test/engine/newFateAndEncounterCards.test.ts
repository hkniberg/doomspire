import { FATE_CARDS } from "@/content/fateCards";
import { handleEncounterCard } from "@/engine/handlers/adventureCardHandler";
import { handleBuildingUsage } from "@/engine/handlers/buildingUsageHandler";
import { resolveFateCard } from "@/engine/handlers/fateCardHandler";
import { handleExploration, handleTileClaiming } from "@/engine/handlers/tileArrivalHandler";
import { GameState } from "@/game/GameState";
import { GameSettings } from "@/lib/GameSettings";
import { Decision, DecisionContext } from "@/lib/types";
import { PlayerAgent } from "@/players/PlayerAgent";
import { getChampionItemCapacity, getChampionMovementBudget } from "@/players/PlayerUtils";

const noLog = () => { };

/** Scripted agent: answers decisions via the provided chooser. */
function scriptedAgent(name: string, choose: (ctx: DecisionContext) => string): PlayerAgent {
  return {
    getName: () => name,
    getType: () => "random",
    decideDiceAction: async () => { throw new Error("not used"); },
    makeDecision: async (_gs, _log, ctx): Promise<Decision> => ({ choice: choose(ctx) }),
    makeTraderDecision: async () => { throw new Error("not used"); },
    makeHarvestDecision: async () => { throw new Error("not used"); },
  };
}

function newGame(): GameState {
  return GameState.createWithPlayerNames(["A", "B", "C", "D"], { fame: 1, food: 10, gold: 10 });
}

function getFateCard(id: string) {
  const card = FATE_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`No fate card ${id}`);
  return card;
}

describe("New fate cards", () => {
  test("Royal Honor: vote target gains 2 fame", async () => {
    const gs = newGame();
    const agents = gs.players.map((p) => scriptedAgent(p.name, () => "B"));
    const before = gs.getPlayer("B")!.fame;
    await resolveFateCard(getFateCard("royal-honor"), gs, agents, [], noLog);
    expect(gs.getPlayer("B")!.fame).toBe(before + 2);
  });

  test.each([
    ["prosperous-crops", "noDiceTax", true],
    ["lean-times", "diceTaxPerDie", 3],
    ["trade-boom", "marketRate1to1", true],
    ["tailwind", "knightMovementBonus", 1],
    ["bounty", "monsterFameBonus", 1],
    ["homesteading", "claimFameBonus", 1],
    ["cartographers-prize", "explorationFameBonus", 1],
  ] as const)("%s sets fateEffects.%s", async (id, key, expected) => {
    const gs = newGame();
    const agents = gs.players.map((p) => scriptedAgent(p.name, (ctx) => ctx.options[0].id));
    await resolveFateCard(getFateCard(id), gs, agents, [], noLog);
    expect((gs.fateEffects as Record<string, unknown>)[key]).toBe(expected);
  });

  test("Dragon Gifts: ranked payout with ties sharing the higher reward", async () => {
    const gs = newGame();
    const [a, b, c, d] = gs.players;
    a.fame = 5; b.fame = 3; c.fame = 3; d.fame = 0;
    const goldBefore = gs.players.map((p) => p.resources.gold);
    const agents = gs.players.map((p) => scriptedAgent(p.name, () => "gold"));
    await resolveFateCard(getFateCard("dragon-gifts"), gs, agents, [], noLog);
    expect(gs.players.map((p, i) => p.resources.gold - goldBefore[i])).toEqual([3, 2, 2, 1]);
  });

  test("Beasts Are Stirring: a beast is placed on an empty den", async () => {
    const gs = newGame();
    const dens = gs.board.findTiles((t) => t.tileType === "wolfDen");
    expect(dens.length).toBeGreaterThan(0);
    dens.forEach((den) => { den.monster = undefined; });
    // Player A places on the first available den, everyone else declines
    const agents = gs.players.map((p, i) =>
      scriptedAgent(p.name, (ctx) => i === 0 ? ctx.options.find((o) => o.id !== "decline")!.id : "decline"));
    await resolveFateCard(getFateCard("beasts-are-stirring"), gs, agents, [], noLog);
    const placedWolves = dens.filter((d) => gs.getTile(d.position)!.monster?.id === "wolf").length;
    expect(placedWolves).toBe(1);
  });

  test("Trade Boom: market sells at 1:1", () => {
    const gs = newGame();
    const player = gs.players[0];
    player.buildings.push("market");
    player.resources.food = 3;
    const goldBefore = player.resources.gold;
    gs.fateEffects.marketRate1to1 = true;
    handleBuildingUsage(player, { buildingUsageDecision: { sellAtMarket: { food: 3 } } } as never, gs, noLog);
    expect(player.resources.gold - goldBefore).toBe(3);
  });

  test("Homesteading: claiming a resource tile grants +1 fame", () => {
    const gs = newGame();
    const player = gs.players[0];
    const tile = gs.board.findTiles((t) => t.tileType === "resource" && t.claimedBy === undefined)[0];
    gs.fateEffects.claimFameBonus = 1;
    const before = player.fame;
    handleTileClaiming(gs, tile, player, 1, true, noLog);
    expect(player.fame - before).toBe(1);
  });

  test("Cartographer's Prize: exploring grants +1 extra fame", () => {
    const gs = newGame();
    const player = gs.players[0];
    const tile = gs.board.findTiles((t) => t.explored === false && t.tileType !== "doomspire")[0];
    gs.fateEffects.explorationFameBonus = 1;
    const before = player.fame;
    handleExploration(gs, tile, player, noLog);
    expect(player.fame - before).toBe(GameSettings.FAME_AWARD_FOR_EXPLORATION + 1);
  });
});

describe("Movement budget (Tailwind + Abandoned Mule)", () => {
  test("bonuses and caps combine correctly", () => {
    const gs = newGame();
    const champion = gs.players[0].champions[0];
    expect(getChampionMovementBudget(champion, [3], {})).toBe(3);
    expect(getChampionMovementBudget(champion, [3], { knightMovementBonus: 1 })).toBe(4);
    // Tailwind applies once per movement, even when sprinting with multiple dice
    expect(getChampionMovementBudget(champion, [3, 2], { knightMovementBonus: 1 })).toBe(6);

    champion.followers.push({ id: "abandoned-mule", name: "Abandoned Mule" });
    expect(getChampionMovementBudget(champion, [3], {})).toBe(2);
    expect(getChampionMovementBudget(champion, [3, 3], {})).toBe(4);
    expect(getChampionMovementBudget(champion, [3], { knightMovementBonus: 1 })).toBe(3);
    expect(getChampionItemCapacity(champion)).toBe(4);
  });
});

describe("New encounter cards", () => {
  test("Wandering Monk takes over an opponent's resource tile", async () => {
    const gs = newGame();
    const player = gs.players[0];
    const tile = gs.board.findTiles((t) => t.tileType === "resource" && t.claimedBy === undefined)[0];
    tile.claimedBy = "B";
    const agent = scriptedAgent("A", (ctx) => ctx.options.find((o) => o.id !== "decline")!.id);
    const championTile = gs.getTile(player.champions[0].position)!;
    await handleEncounterCard("wandering-monk", gs, championTile, player, agent, 1, [], noLog);
    expect(tile.claimedBy).toBe("A");
  });

  test("Abandoned Mule joins as a follower", async () => {
    const gs = newGame();
    const player = gs.players[0];
    const agent = scriptedAgent("A", (ctx) => ctx.options[0].id);
    const championTile = gs.getTile(player.champions[0].position)!;
    await handleEncounterCard("abandoned-mule", gs, championTile, player, agent, 1, [], noLog);
    expect(player.champions[0].followers.some((f) => f.id === "abandoned-mule")).toBe(true);
  });
});
