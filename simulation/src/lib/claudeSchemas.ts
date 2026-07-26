/**
 * Lords of Doomspire - Claude API Schema Definitions
 * 
 * This file defines the JSON schemas used for structured communication with Claude.
 * These schemas ensure that Claude's responses match our expected data formats.
 */

/**
 * Schema for tile action parameters
 */
// Note: all fields are required (use false / empty arrays when not applicable).
// Optional fields blow up the structured-outputs grammar - the API limits the
// total number of optional parameters per request to 24, and this schema is
// embedded twice in the dice action schema.
export const tileActionSchema = {
  type: "object",
  description: "Actions to perform on a tile. All fields must be provided: use false or an empty array for actions you don't want to take.",
  properties: {
    claimTile: {
      type: "boolean",
      description: "Claim this tile (place a village). Does nothing unless the tile is an unclaimed resource tile and your champion is still on it after any combat - so set it speculatively when entering unexplored tiles or fighting on a resource tile. A successful claim counts as the tile interaction, ending this champion's dice actions this round."
    },
    useTrader: {
      type: "boolean",
      description: "Whether to interact with the trader on this tile"
    },
    useMercenary: {
      type: "boolean",
      description: "Whether to pay the mercenary for might"
    },
    useTemple: {
      type: "boolean",
      description: "Whether to sacrifice fame for might at the temple"
    },
    pickUpItems: {
      type: "array",
      items: { type: "string" },
      description: "Array of item IDs to pick up from this tile (empty array for none)"
    },
    dropItems: {
      type: "array",
      items: { type: "string" },
      description: "Array of item IDs to drop on this tile (empty array for none)"
    },
    conquer: {
      type: "boolean",
      description: "Conquer another player's unprotected resource tile by force (costs 2 fame, replaces their village with yours)"
    },
    bribe: {
      type: "boolean",
      description: "Take over another player's unprotected resource tile through bribery (costs 2 gold, replaces their village with yours)"
    },
  },
  required: ["claimTile", "useTrader", "useMercenary", "useTemple", "pickUpItems", "dropItems", "conquer", "bribe"],
  additionalProperties: false
};

/**
 * Schema for position coordinates
 */
export const positionSchema = {
  type: "object",
  description: "Position coordinates on the game board",
  properties: {
    row: { type: "number", description: "Row coordinate" },
    col: { type: "number", description: "Column coordinate" }
  },
  required: ["row", "col"],
  additionalProperties: false
};

/**
 * Schema for ocean position coordinates  
 */
export const oceanPositionSchema = {
  type: "string",
  enum: ["nw", "ne", "sw", "se"],
  description: "Ocean zone position"
};

/**
 * Schema for championAction action parameters
 */
export const championActionSchema = {
  type: "object",
  description: "Parameters for championAction - move a champion and perform tile actions",
  properties: {
    diceValueUsed: {
      type: "number",
      description: "Which of your remaining dice values (1, 2 or 3) to use"
    },
    diceValuesUsed: {
      type: "array",
      items: { type: "number" },
      description: "Optional: combine two or more dice into one longer movement (sprinting). List the individual dice, not their total - a 5 step sprint is [3, 2], not [5]. If provided, diceValueUsed is ignored."
    },
    championId: {
      type: "number",
      description: "ID of the champion to move"
    },
    movementPathIncludingStartPosition: {
      type: "array",
      items: positionSchema,
      description: "Complete movement path including starting position (empty array or single position for no movement)"
    },
    tileAction: tileActionSchema
  },
  required: ["diceValueUsed", "championId"],
  additionalProperties: false
};

/**
 * Schema for boatAction action parameters
 */
export const boatActionSchema = {
  type: "object",
  description: "Parameters for boatAction - move a boat and optionally transport a champion",
  properties: {
    diceValueUsed: {
      type: "number",
      description: "Which of your remaining dice values (1, 2 or 3) to use"
    },
    boatId: {
      type: "number",
      description: "ID of the boat to move"
    },
    movementPathIncludingStartPosition: {
      type: "array",
      items: oceanPositionSchema,
      description: "Complete movement path including starting position (empty array or single position for no movement)"
    },
    championIdToPickUp: {
      type: "number",
      description: "Optional champion ID to pick up from a coastal tile (Must be coastal - row 0, row 7, col 0, or col 7)."
    },
    championDropPosition: {
      ...positionSchema,
      description: "Position to drop off the champion (must be coastal)"
    },
    championTileAction: tileActionSchema
  },
  required: ["diceValueUsed", "boatId"],
  additionalProperties: false
};

/**
 * Schema for harvestAction action parameters
 */
export const harvestActionSchema = {
  type: "object",
  description: "Parameters for harvestAction - save dice for the harvest phase. Which tiles to harvest from is decided later, during the harvest phase.",
  properties: {
    diceValuesUsed: {
      type: "array",
      items: { type: "number" },
      description: "Which of your remaining dice values (1, 2 or 3) to save for the harvest phase"
    }
  },
  required: ["diceValuesUsed"],
  additionalProperties: false
};

/**
 * Schema for building usage decision parameters
 */
export const buildingUsageDecisionSchema = {
  type: "object",
  description: "Parameters for using existing buildings. These are resolved in a fixed order - market first, then blacksmith, then fletcher - and each is paid from what you hold at that point, AFTER your harvest and after any earlier step. Declare the whole plan you intend, based on what you will hold when each step runs rather than on your stockpile right now. Omit fields entirely for buildings you don't have or don't want to use.",
  properties: {
    useBlacksmith: {
      type: "boolean",
      description: "Set true to buy 1 might for 1 gold + 3 ore. Resolved after your harvest and after your market sale, so set this true whenever your plan will cover the cost by then - gold raised at the market in the same harvest phase can pay for it."
    },
    sellAtMarket: {
      type: "object",
      description: "Resources to sell at the market (2:1 for gold, pooled across resource types; 1:1 during Trade Boom). Resolved after your harvest, so you may sell resources you are about to harvest this round. Amounts must not be negative. Omit this field entirely if you don't have a market or don't want to sell anything.",
      properties: {
        food: { type: "number" },
        wood: { type: "number" },
        ore: { type: "number" }
      },
      additionalProperties: false
    },
    useFletcher: {
      type: "boolean",
      description: "Set true to buy 1 might for 3 wood + 1 ore. Resolved last of the three, after your harvest, market sale and blacksmith, so set this true whenever your plan will still cover the cost by then."
    }
  },
  additionalProperties: false
};

/**
 * Schema for the harvest phase decision responses from Claude:
 * which tiles to harvest, which buildings to use, and what to build.
 */
export const harvestDecisionSchema = {
  type: "object",
  description: "The harvest phase decision: harvest tiles, building usage, and build action",
  properties: {
    harvestTiles: {
      type: "array",
      items: positionSchema,
      description: "Positions of the tiles to harvest from, using your saved dice. Only tiles listed as eligible in the prompt count, and the number of different tiles is capped by the total value of your saved dice - anything beyond the cap is ignored. Leave empty if you saved no dice."
    },
    buildingUsageDecision: buildingUsageDecisionSchema,
    buildAction: {
      type: "string",
      enum: ["blacksmith", "market", "recruitChampion", "buildBoat", "chapel", "upgradeChapelToMonastery", "warshipUpgrade", "fletcher"],
      description: "Type of build action to perform (construct building, recruit champion, etc.). Paid last, after your harvest and all building usage, so judge affordability against what you will hold at that point. Only pick one of the build options listed as still open to you in the prompt. Omit this field entirely if you would rather save the resources."
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of why these decisions were made"
    }
  },
  additionalProperties: false
};

/**
 * Main schema for dice action responses from Claude.
 *
 * Modeled as anyOf with one branch per action type, so that the payload matching the
 * actionType is REQUIRED - otherwise the model can (and occasionally does) emit an
 * actionType with no payload, which is schema-valid but unusable.
 */
const reasoningProperty = {
  type: "string",
  description: "Brief explanation of why this action was chosen"
};

export const diceActionSchema = {
  description: "A single dice action to perform during the movement phase",
  anyOf: [
    {
      type: "object",
      description: "Do something with a champion (move and/or act on a tile)",
      properties: {
        actionType: { const: "championAction" },
        championAction: championActionSchema,
        reasoning: reasoningProperty
      },
      required: ["actionType", "championAction"],
      additionalProperties: false
    },
    {
      type: "object",
      description: "Do something with a boat (move and/or transport a champion)",
      properties: {
        actionType: { const: "boatAction" },
        boatAction: boatActionSchema,
        reasoning: reasoningProperty
      },
      required: ["actionType", "boatAction"],
      additionalProperties: false
    },
    {
      type: "object",
      description: "Save one or more dice for the harvest phase",
      properties: {
        actionType: { const: "harvestAction" },
        harvestAction: harvestActionSchema,
        reasoning: reasoningProperty
      },
      required: ["actionType", "harvestAction"],
      additionalProperties: false
    }
  ]
};

/**
 * Schema for decision responses from Claude
 */
export const decisionSchema = {
  type: "object",
  description: "Response to a decision prompt",
  properties: {
    choice: {
      type: "string",
      description: "The chosen option ID"
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of why this choice was made"
    }
  },
  required: ["choice"],
  additionalProperties: false
};

/**
 * Schema for trader decision responses from Claude
 */
export const traderDecisionSchema = {
  type: "object",
  description: "Decision about trader interactions",
  properties: {
    actions: {
      type: "array",
      description: "Array of trader actions to perform",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["buyItem", "sellResources"],
            description: "Type of trader action"
          },
          itemId: {
            type: "string",
            description: "ID of the item to purchase (required for buyItem actions)"
          },
          resourcesSold: {
            type: "object",
            description: "Resources to sell. Amounts must not be negative.",
            properties: {
              food: { type: "number" },
              wood: { type: "number" },
              ore: { type: "number" },
              gold: { type: "number" }
            },
            additionalProperties: false
          },
          resourceRequested: {
            type: "string",
            enum: ["food", "wood", "ore", "gold"],
            description: "Resource type to receive in exchange (required for sellResources actions)"
          }
        },
        required: ["type"],
        additionalProperties: false
      }
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of the trader decisions"
    }
  },
  required: ["actions"],
  additionalProperties: false
};
