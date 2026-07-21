export type Resource = "food" | "wood" | "ore" | "gold";
export type ResourceList = Resource[];
export type TileDef =
  | "home"
  | "empty"
  | "adventure"
  | "adventure2"
  | "adventure3"
  | "doomspire"
  | "temple"
  | "trader"
  | "mercenary"
  | "oasis"
  | "oasis2"
  | "wolfDen"
  | "bearCave"
  | ResourceList
  | Resource;

// L-shaped tile group.
export interface TileTrioDef {
  corner: TileDef;
  right: TileDef;
  below: TileDef;
  count?: number; // How many trios like tihs are in the box, default 1
}

export const HOME_TILE_TRIOS: TileTrioDef[] = [
  {
    corner: "home",
    right: "food",
    below: "adventure",
  },
  {
    corner: "home",
    right: "wood",
    below: "adventure",
  },
  {
    corner: "home",
    right: "adventure",
    below: "food",
  },
  {
    corner: "home",
    right: "adventure",
    below: "ore",
  },
];

export const TIER_1_TRIOS: TileTrioDef[] = [
  {
    corner: "temple",
    right: "wood",
    below: "adventure",
  },
  {
    corner: "adventure",
    right: "mercenary",
    below: "food",
  },
  {
    corner: "ore",
    right: "adventure",
    below: "trader",
  },
  {
    corner: "gold",
    right: "wolfDen",
    below: "oasis",
  },
  {
    corner: "adventure2",
    right: "ore",
    below: "wolfDen",
  },
  {
    corner: "wood",
    right: "adventure",
    below: "adventure2",
  },
  {
    corner: "food",
    right: "adventure2",
    below: "oasis",
  },
  { 
    corner: "adventure",
    right: ["food", "ore"],
    below: "wolfDen",
  },
  {
    corner: "wood",
    right: "ore",
    below: "adventure",
  },
  {
    corner: "food",
    right: "ore",
    below: "adventure",
  },
  {
    corner: "oasis",
    right: "gold",
    below: ["ore", "ore"],
  },
  {
    corner: ["food", "food"],
    right: "wood",
    below: "adventure",
  },
];

export const TIER_2_TRIOS: TileTrioDef[] = [
  {
    corner: "adventure2",
    right: "bearCave",
    below: ["gold", "gold"],
  },
  {
    corner: ["ore", "ore"],
    right: "adventure2",
    below: "bearCave",
  },
  {
    corner: ["wood", "wood"],
    right: "oasis",
    below: "adventure2",
  },
  {
    corner: "adventure2",
    right: ["wood", "ore"],
    below: ["food", "food"],
  },
];


