import { DiceRolls } from "@/engine/DiceRolls";
import { GameMaster } from "@/engine/GameMaster";
import { areOceanZonesAdjacent } from "@/engine/actions/moveCalculator";
import type { BoatAction, DiceAction } from "@/lib/actionTypes";
import type { OceanPosition, Position } from "@/lib/types";
import { RandomPlayerAgent } from "@/players/RandomPlayerAgent";

// Ocean zones are 4 L-shaped corner tiles forming a ring (nw-ne-se-sw-nw), so a boat
// can only step between touching zones, and boat transport is subject to the same tile
// entry restrictions as knight movement.
describe("Boat movement", () => {
  function setup() {
    const gameMaster = new GameMaster({
      players: [
        new RandomPlayerAgent("A"),
        new RandomPlayerAgent("B"),
        new RandomPlayerAgent("C"),
        new RandomPlayerAgent("D"),
      ],
      startingValues: { food: 20 },
      seed: 42,
    });
    gameMaster.start();
    return { gameMaster, player: gameMaster.getGameState().players[0] };
  }

  function validate(gameMaster: GameMaster, player: any, boatAction: BoatAction, dice: number[] = [1, 2, 3]) {
    const diceAction: DiceAction = { actionType: "boatAction", boatAction };
    return () => (gameMaster as any).validateDiceAction(player, diceAction, new DiceRolls(dice));
  }

  describe("ocean zone adjacency", () => {
    test("each zone touches exactly the two zones beside it in the ring", () => {
      expect(areOceanZonesAdjacent("nw", "ne")).toBe(true);
      expect(areOceanZonesAdjacent("nw", "sw")).toBe(true);
      expect(areOceanZonesAdjacent("ne", "se")).toBe(true);
      expect(areOceanZonesAdjacent("sw", "se")).toBe(true);
    });

    test("diagonally opposite zones do not touch", () => {
      expect(areOceanZonesAdjacent("nw", "se")).toBe(false);
      expect(areOceanZonesAdjacent("se", "nw")).toBe(false);
      expect(areOceanZonesAdjacent("ne", "sw")).toBe(false);
      expect(areOceanZonesAdjacent("sw", "ne")).toBe(false);
    });
  });

  describe("path validation", () => {
    test("rejects a jump between diagonally opposite zones", () => {
      const { gameMaster, player } = setup();
      player.boats[0].position = "nw" as OceanPosition;

      expect(
        validate(gameMaster, player, {
          diceValueUsed: 3,
          boatId: player.boats[0].id,
          movementPathIncludingStartPosition: ["nw", "se"],
        })
      ).toThrow(/not adjacent/);
    });

    test("rejects a path that does not start at the boat's current zone", () => {
      const { gameMaster, player } = setup();
      player.boats[0].position = "nw" as OceanPosition;

      expect(
        validate(gameMaster, player, {
          diceValueUsed: 3,
          boatId: player.boats[0].id,
          movementPathIncludingStartPosition: ["ne", "se"],
        })
      ).toThrow(/must start at the boat's current ocean zone/);
    });

    test("rejects a path longer than the die value", () => {
      const { gameMaster, player } = setup();
      player.boats[0].position = "nw" as OceanPosition;

      expect(
        validate(gameMaster, player, {
          diceValueUsed: 1,
          boatId: player.boats[0].id,
          movementPathIncludingStartPosition: ["nw", "ne", "se"],
        })
      ).toThrow(/is 2 steps, but the die only allows up to 1/);
    });

    test("accepts staying put, a single step, and a path that doubles back", () => {
      const { gameMaster, player } = setup();
      player.boats[0].position = "ne" as OceanPosition;
      const boatId = player.boats[0].id;

      expect(validate(gameMaster, player, {
        diceValueUsed: 1,
        boatId,
        movementPathIncludingStartPosition: ["ne"],
      })).not.toThrow();

      expect(validate(gameMaster, player, {
        diceValueUsed: 1,
        boatId,
        movementPathIncludingStartPosition: ["ne", "nw"],
      })).not.toThrow();

      // The "advanced example" from the rules: out and back to pick up a knight en route
      expect(validate(gameMaster, player, {
        diceValueUsed: 2,
        boatId,
        movementPathIncludingStartPosition: ["ne", "nw", "ne"],
      })).not.toThrow();
    });
  });

  describe("drop restrictions", () => {
    async function attemptDrop(gameMaster: GameMaster, player: any, dropPosition: Position) {
      const boatAction: BoatAction = {
        diceValueUsed: 1,
        boatId: player.boats[0].id,
        championIdToPickUp: player.champions[0].id,
        championDropPosition: dropPosition,
      };
      await (gameMaster as any).transportChampionByBoat(
        player,
        boatAction,
        player.champions[0].id,
        player.champions[0].position,
        player.boats[0].position,
        player.boats[0].position,
        ""
      );
    }

    test("a knight cannot be dropped on another player's home tile", async () => {
      const { gameMaster, player } = setup();
      const enemyHome = gameMaster.getGameState().players[1].homePosition;
      const startPosition = { ...player.champions[0].position };

      await attemptDrop(gameMaster, player, enemyHome);

      expect(player.champions[0].position).toEqual(startPosition);
      expect(
        gameMaster.getGameLog().some((entry) => entry.content.includes("cannot enter another player's home tile"))
      ).toBe(true);
    });

    test("a knight cannot be dropped on a tile holding one of your own knights", async () => {
      const { gameMaster, player } = setup();
      const occupied: Position = { row: 0, col: 3 };
      player.champions.push({ ...player.champions[0], id: 99, position: occupied });
      const startPosition = { ...player.champions[0].position };

      await attemptDrop(gameMaster, player, occupied);

      expect(player.champions[0].position).toEqual(startPosition);
      expect(
        gameMaster.getGameLog().some((entry) => entry.content.includes("one of your own knights is already there"))
      ).toBe(true);
    });
  });
});
