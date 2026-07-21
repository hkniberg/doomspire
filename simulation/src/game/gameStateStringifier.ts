import { GameState } from "../game/GameState";
import { GameSettings } from "../lib/GameSettings";
import type { CarriableItem, Champion, Monster, Player, ResourceType, Tile } from "../lib/types";

/**
 * Converts a GameState to a readable markdown string
 */
export function stringifyGameState(gameState: GameState): string {
  const sections: string[] = [];

  // Game session section
  sections.push(formatGameSession(gameState));

  // Players section
  sections.push(formatPlayers(gameState));

  // Board section
  sections.push(formatBoard(gameState));

  return sections.join("\n\n");
}

/**
 * Converts a single tile to a single line, readable string with more info, optimized for use in game log.
 */
export function stringifyTileForGameLog(tile: Tile, gameState: GameState, ignorePlayerName?: string): string {
  const sentences: string[] = [];

  if (!tile.explored) {
    sentences.push(`This is an unexplored tier ${tile.tier} tile`);
  } else {
    // Format based on tile type
    switch (tile.tileType) {
      case "home":
        const homeOwner = getPlayerByHomePosition(tile.position, gameState);
        sentences.push(`This is a home tile for ${homeOwner?.name || "unknown"} (can ONLY be entered by ${homeOwner?.name || "unknown"}'s champions)`);
        break;
      case "resource":
        let resourceDescription = "This is a resource tile";
        if (tile.resources) {
          const resourceStr = formatResources(tile.resources);
          if (resourceStr) {
            resourceDescription += ` (${resourceStr})`;
          }
        }
        if (tile.isStarred) {
          resourceDescription += " (starred)";
        }
        if (tile.claimedBy) {
          const player = gameState.getPlayer(tile.claimedBy);
          resourceDescription += ` owned by ${player?.name || "unknown"}`;
          if (gameState.isClaimProtected(tile)) {
            resourceDescription += " (protected)";
          }
        }
        sentences.push(resourceDescription);
        break;
      case "adventure":
        sentences.push("This is an adventure tile");
        if (tile.adventureTokens === 0) {
          sentences.push("No adventure cards left");
        }
        break;
      case "temple":
        sentences.push(`This is a temple (no combat). Sacrifice ${GameSettings.TEMPLE_FAME_COST} fame to gain 1 might (once per round)`);
        break;
      case "trader":
        sentences.push("This is a trader (no combat). Exchange 2 of any resource (food/wood/ore/gold) for 1 of any resource. Buy weapons/tools/items for gold. Once per round");
        break;
      case "mercenary":
        sentences.push(`This is a mercenary camp (no combat). Buy 1 might for ${GameSettings.MERCENARY_GOLD_COST} gold (once per round)`);
        break;
      case "doomspire":
        sentences.push("This is the Doomspire");
        // Add dragon information for doomspire
        sentences.push(`There is a Dragon here (might ${GameSettings.DRAGON_BASE_MIGHT} + 2D3). Impress it or be eaten`);
        break;
      case "oasis":
        sentences.push("This is an oasis");
        break;
      case "wolfDen":
        sentences.push("This is a wolf den");
        break;
      case "bearCave":
        sentences.push("This is a bear cave");
        break;
      case "empty":
        sentences.push("This is an empty tile");
        break;
      default:
        sentences.push(`This is a tier ${tile.tier} tile`);
    }
  }

  // Add monster information as a separate sentence
  if (tile.monster) {
    const monsterId = tile.monster.id;
    const article = ['a', 'e', 'i', 'o', 'u'].includes(monsterId.toLowerCase().charAt(0)) ? 'an' : 'a';
    sentences.push(`There is ${article} ${formatMonsterInfo(tile.monster)} here`);
  }

  // Add champions on this tile, but exclude the specified player if ignorePlayerName is provided
  const championsOnTile = getChampionsOnTile(tile.position, gameState);
  for (const champion of championsOnTile) {
    if (ignorePlayerName && champion.playerName === ignorePlayerName) {
      continue; // Skip this player's champions
    }
    const player = gameState.getPlayer(champion.playerName);
    sentences.push(`${player?.name || "unknown"} champion${champion.id} is here`);
  }

  // Add items on this tile as separate sentences
  if (tile.items && tile.items.length > 0) {
    for (const item of tile.items) {
      const itemId = getCarriableItemId(item);
      sentences.push(`There is a ${itemId} here`);
    }
  }

  return sentences.join(". ") + ".";
}

function formatGameSession(gameState: GameState): string {
  const currentPlayer = gameState.getCurrentPlayer();
  const lines = [`# Game session
- Current round: ${gameState.currentRound}
- Current player: ${currentPlayer.name}`];
  if (gameState.fateEffects.fateCardName) {
    const effectText = gameState.fateEffects.fateCardEffect ? ` - ${gameState.fateEffects.fateCardEffect}` : "";
    lines.push(`- Fate card this round: ${gameState.fateEffects.fateCardName}${effectText}`);
  }
  return lines.join("\n");
}

function formatPlayers(gameState: GameState): string {
  const sections: string[] = ["# Players"];

  for (const player of gameState.players) {
    sections.push(stringifyPlayer(player, gameState));
  }

  return sections.join("\n\n");
}

export function stringifyPlayer(player: Player, gameState: GameState): string {
  const lines: string[] = [`## ${player.name}`];

  // Basic stats
  lines.push(`- Might: ${player.might}`);
  lines.push(`- Fame: ${player.fame}`);
  lines.push(`- Dragon impressions: ${player.dragonImpressions}/${GameSettings.DRAGON_IMPRESSIONS_TO_WIN}`);
  lines.push(`- Home: ${formatPosition(player.homePosition)}`);

  // Resources
  const resourceStr = formatResources(player.resources);
  lines.push(`- Resource stockpile: ${resourceStr || "none"}`);

  // Champions
  for (const champion of player.champions) {
    lines.push(formatChampion(champion, player.name));
  }

  // Boats
  for (const boat of player.boats) {
    lines.push(`- boat${boat.id} at (${boat.position})`);
  }

  // Buildings
  if (player.buildings && player.buildings.length > 0) {
    lines.push("- Buildings:");
    for (const building of player.buildings) {
      lines.push(`  - ${formatBuildingInfo(building)}`);
    }
  } else {
    lines.push("- Buildings: none");
  }

  // Claims
  const claimedTiles = gameState.getClaimedTiles(player.name);
  if (claimedTiles.length > 0) {
    lines.push(`- claims (${claimedTiles.length} tiles):`);
    for (const tile of claimedTiles) {
      lines.push(formatClaimedTile(tile, gameState));
    }
  } else {
    lines.push("- no claims");
  }

  return lines.join("\n");
}

function formatChampion(champion: Champion, playerName: string): string {
  let line = `- champion${champion.id} at ${formatPosition(champion.position)}`;

  if (champion.hasInteractedThisRound) {
    line += ` (has interacted this round, cannot use more action dice)`;
  }

  // Add items with full details
  for (const item of champion.items) {
    const itemDetails = getCarriableItemDetails(item);
    line += `\n  - Has ${itemDetails}`;
  }

  // Add followers
  for (const follower of champion.followers) {
    line += `\n  - Follower: ${follower.name} (${follower.id})`;
  }

  return line;
}

function formatClaimedTile(tile: Tile, gameState: GameState): string {
  let line = `  - Tile ${formatPosition(tile.position)}`;

  // Add starred indicator
  if (tile.isStarred) {
    line += " (starred)";
  }

  if (tile.resources) {
    const resourceStr = formatResources(tile.resources);
    if (resourceStr) {
      line += ` providing ${resourceStr}`;
    }
  }

  // Check if protected
  if (gameState.isClaimProtected(tile)) {
    line += ` (protected)`;
  }

  // Check if blockaded (using game rules)
  const blockaderPlayerName = gameState.getClaimBlockader(tile);
  if (blockaderPlayerName) {
    const blockaderPlayer = gameState.getPlayer(blockaderPlayerName);
    // Find the champion that's doing the blockading
    const blockadingChampions = getChampionsOnTile(tile.position, gameState).filter(
      (champ) => champ.playerName === blockaderPlayerName,
    );
    const championId = blockadingChampions.length > 0 ? blockadingChampions[0].id : '';
    line += ` (blockaded by ${blockaderPlayer?.name} champion${championId})`;
  }

  return line;
}

function formatBoard(gameState: GameState): string {
  const sections: string[] = ["# Board"];

  // Show all tiles
  for (const row of gameState.board.getTilesGrid()) {
    for (const tile of row) {
      sections.push(formatTileForBoard(tile, gameState));
    }
  }

  return sections.join("\n\n");
}

function formatTileForBoard(tile: Tile, gameState: GameState): string {
  const lines: string[] = [`Tile ${formatPosition(tile.position)}`];

  if (!tile.explored) {
    lines.push(`- Unexplored tier ${tile.tier} tile`);
  } else {
    // Format based on tile type
    switch (tile.tileType) {
      case "home":
        const homeOwner = getPlayerByHomePosition(tile.position, gameState);
        lines.push(`- Home tile for ${homeOwner?.name || "unknown"} (can ONLY be entered by ${homeOwner?.name || "unknown"}'s champions)`);
        break;
      case "resource":
        if (tile.resources) {
          const resourceStr = formatResources(tile.resources);
          if (resourceStr) {
            const starredPrefix = tile.isStarred ? "Starred " : "";
            const unclaimedPrefix = !tile.claimedBy ? "Unclaimed " : "";
            lines.push(`- ${unclaimedPrefix}${starredPrefix}Resource tile providing ${resourceStr}`);
          }
        }
        if (tile.claimedBy) {
          const player = gameState.getPlayer(tile.claimedBy);
          lines.push(`- Claimed by ${player?.name || "unknown"}`);

          // Check protection status (blockade info will be shown with champion details)
          const isProtected = gameState.isClaimProtected(tile);

          if (isProtected) {
            lines.push("- Protected by unit in neighbouring tile");
          }
        }
        if (tile.monster) {
          lines.push(`- Monster: ${formatMonsterInfo(tile.monster)}`);
        }
        break;
      case "adventure":
        lines.push(`- Tier ${tile.tier} adventure tile`);
        if (tile.adventureTokens === 0) {
          lines.push(`- No adventure cards left`);
        }
        if (tile.monster) {
          lines.push(`- Monster: ${formatMonsterInfo(tile.monster)}`);
        }
        break;
      case "temple":
        lines.push(`- Temple (no combat). Sacrifice ${GameSettings.TEMPLE_FAME_COST} fame to gain 1 might (once per round)`);
        break;
      case "trader":
        lines.push("- Trader (no combat). Exchange 2 of any resource (food/wood/ore/gold) for 1 of any resource. Buy weapons/tools/items for gold. Once per round");
        break;
      case "mercenary":
        lines.push(`- Mercenary camp (no combat). Buy 1 might for ${GameSettings.MERCENARY_GOLD_COST} gold (once per round)`);
        break;
      case "doomspire":
        lines.push(`- Doomspire Dragon (might ${GameSettings.DRAGON_BASE_MIGHT} + 2D3). Impress it (${GameSettings.VICTORY_FAME_THRESHOLD}+ fame, ${GameSettings.VICTORY_GOLD_THRESHOLD}+ gold, ${GameSettings.VICTORY_STARRED_TILES_THRESHOLD}+ starred tiles, or defeat it in combat) or be eaten. First player to impress it ${GameSettings.DRAGON_IMPRESSIONS_TO_WIN} times wins`);
        if (tile.treasureStacks && tile.treasureStacks.length > 0) {
          lines.push(`- Dragon's treasure hoard: ${tile.treasureStacks.length} stack(s) remaining (take one as reward for impressing the dragon)`);
        }
        break;
      case "oasis":
        lines.push(`- Tier ${tile.tier} oasis`);
        break;
      case "wolfDen":
        lines.push("- Wolf Den");
        if (tile.monster) {
          lines.push(`- Monster: ${formatMonsterInfo(tile.monster)}`);
        }
        break;
      case "bearCave":
        lines.push("- Bear Cave");
        if (tile.monster) {
          lines.push(`- Monster: ${formatMonsterInfo(tile.monster)}`);
        }
        break;
      default:
        lines.push(`- Tier ${tile.tier} tile`);
    }
  }

  // Add champions on this tile
  const championsOnTile = getChampionsOnTile(tile.position, gameState);
  for (const champion of championsOnTile) {
    const player = gameState.getPlayer(champion.playerName);
    let championLine = `- ${player?.name || "unknown"} champion${champion.id} is here`;

    // For resource tiles, check if this champion is blockading
    if (tile.tileType === "resource" && tile.claimedBy && tile.claimedBy !== champion.playerName) {
      const blockaderPlayerName = gameState.getClaimBlockader(tile);
      if (blockaderPlayerName === champion.playerName) {
        championLine += ", blockading";
      } else {
        championLine += " (not blockading)";
      }
    }

    lines.push(championLine);
  }

  // Add items on this tile
  if (tile.items && tile.items.length > 0) {
    for (const item of tile.items) {
      const itemId = getCarriableItemId(item);
      lines.push(`- Item: ${itemId} (dropped on ground)`);
    }
  }

  return lines.join("\n");
}



function getChampionsOnTile(position: { row: number; col: number }, gameState: GameState): Champion[] {
  const champions: Champion[] = [];
  for (const player of gameState.players) {
    for (const champion of player.champions) {
      if (champion.position.row === position.row && champion.position.col === position.col) {
        champions.push(champion);
      }
    }
  }
  return champions;
}

function getPlayerByHomePosition(
  position: { row: number; col: number },
  gameState: GameState,
): Player | undefined {
  return gameState.players.find(
    (player) => player.homePosition.row === position.row && player.homePosition.col === position.col,
  );
}

function formatPosition(position: { row: number; col: number }): string {
  return `(${position.row},${position.col})`;
}

function formatResources(resources: Record<ResourceType, number>): string {
  const parts: string[] = [];

  if (resources.food > 0) {
    parts.push(`${resources.food} food`);
  }
  if (resources.wood > 0) {
    parts.push(`${resources.wood} wood`);
  }
  if (resources.ore > 0) {
    parts.push(`${resources.ore} ore`);
  }
  if (resources.gold > 0) {
    parts.push(`${resources.gold} gold`);
  }

  return parts.join(", ");
}

// Backward compatibility - keep the class for existing code
export class GameStateStringifier {
  public static stringify(gameState: GameState): string {
    return stringifyGameState(gameState);
  }
}

// Helper function to get detailed information about a CarriableItem
function getCarriableItemDetails(item: CarriableItem): string {
  if (item.treasureCard) {
    return `${item.treasureCard.name} (${item.treasureCard.id}) - ${item.treasureCard.description}`;
  }
  if (item.traderItem) {
    return `${item.traderItem.name} (${item.traderItem.id}) - ${item.traderItem.description}`;
  }
  return 'Unknown Item';
}

// Helper function to format building information with descriptions
export function formatBuildingInfo(buildingType: string): string {
  switch (buildingType) {
    case "market":
      return "market (sell any resources for gold at 2:1 during the harvest phase, resources can be pooled)";
    case "blacksmith":
      return "blacksmith (buy 1 might for 1 gold + 3 ore, once per harvest phase)";
    case "fletcher":
      return "fletcher (buy 1 might for 3 wood + 1 ore, once per harvest phase)";
    case "chapel":
      return "chapel (gave 3 fame when built)";
    case "monastery":
      return "monastery (gave 5 fame when built)";
    case "warshipUpgrade":
      return "warship upgrade (boats provide combat support in adjacent coastal battles)";
    default:
      return buildingType;
  }
}

// Helper function to format monster information with full details
function formatMonsterInfo(monster: Monster): string {
  let monsterInfo = monster.id;

  // Add monster type designation if applicable
  if (monster.monsterType) {
    monsterInfo += ` (${monster.monsterType})`;
  }

  // Add might
  monsterInfo += ` (might ${monster.might})`;

  // Add reward information
  const rewards: string[] = [];
  if (monster.fame > 0) {
    rewards.push(`${monster.fame} fame`);
  }

  // Add non-zero resources
  if (monster.resources.food > 0) {
    rewards.push(`${monster.resources.food} food`);
  }
  if (monster.resources.wood > 0) {
    rewards.push(`${monster.resources.wood} wood`);
  }
  if (monster.resources.ore > 0) {
    rewards.push(`${monster.resources.ore} ore`);
  }
  if (monster.resources.gold > 0) {
    rewards.push(`${monster.resources.gold} gold`);
  }

  if (rewards.length > 0) {
    monsterInfo += ` (reward ${rewards.join(", ")})`;
  }

  return monsterInfo;
}

// Helper function to get the ID of a CarriableItem
function getCarriableItemId(item: CarriableItem): string {
  if (item.treasureCard) {
    return item.treasureCard.id;
  }
  if (item.traderItem) {
    return item.traderItem.id;
  }
  return 'unknown-item';
}

// Helper function to get the name of a CarriableItem (kept for backward compatibility)
function getCarriableItemName(item: CarriableItem): string {
  if (item.treasureCard) {
    return item.treasureCard.name;
  }
  if (item.traderItem) {
    return item.traderItem.name;
  }
  return 'Unknown Item';
}
