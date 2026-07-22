import { Position, TurnStatistics } from "./types";

export function formatResources(
  resources: Record<string, number> | undefined,
  separator: string = " "
): string {
  if (!resources) return "None";

  const formatted = Object.entries(resources)
    .filter(([_, amount]) => amount > 0)
    .map(([type, amount]) => {
      return `${amount} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    })
    .join(separator);

  return formatted || "None";
};

export function formatPosition(position: Position): string {
  return `(${position.row}, ${position.col})`;
}

/**
 * Format a cost object as a readable string for game log messages
 * Example: { food: 2, wood: 0, ore: 2, gold: 1 } => "2 Food + 2 Ore + 1 Gold"
 */
export function formatCost(cost: Record<string, number>): string {
  const parts = Object.entries(cost)
    .filter(([_, amount]) => amount > 0)
    .map(([type, amount]) => {
      const resourceName = type.charAt(0).toUpperCase() + type.slice(1);
      return `${amount} ${resourceName}`;
    });

  return parts.join(" + ");
}

/**
 * Strip the markdown-style formatting used in card descriptions (asterisks, backticks)
 * and collapse newlines, so the description fits on a single game log line.
 */
export function stripCardFormatting(description: string): string {
  return description.replace(/[*`]/g, "").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Calculate Manhattan distance between two positions
 */
export function getManhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
}

/**
 * Export turn statistics to CSV format - same format as StatisticsCollector.exportToCSV()
 */
export function exportStatisticsToCSV(turnHistory: readonly TurnStatistics[]): string {
  if (turnHistory.length === 0) {
    return "";
  }

  const headers: string[] = ["Round"];

  // Generate headers for each player and metric
  const playerNames = turnHistory[0].playerStats.map((p) => p.playerName);

  for (const playerName of playerNames) {
    headers.push(
      `${playerName}_Fame`,
      `${playerName}_Might`,
      `${playerName}_Food`,
      `${playerName}_Wood`,
      `${playerName}_Ore`,
      `${playerName}_Gold`,
      `${playerName}_Champions`,
      `${playerName}_Boats`,
      `${playerName}_TotalItems`,
      `${playerName}_TotalFollowers`,
      `${playerName}_ChampionVsChampionWins`,
      `${playerName}_ChampionVsChampionLosses`,
      `${playerName}_ChampionVsMonsterWins`,
      `${playerName}_ChampionVsMonsterLosses`,
      `${playerName}_DragonEncounters`,
      `${playerName}_MarketInteractions`,
      `${playerName}_BlacksmithInteractions`,
      `${playerName}_TraderInteractions`,
      `${playerName}_TempleInteractions`,
      `${playerName}_MercenaryInteractions`,
      `${playerName}_ChampionActions`,
      `${playerName}_BoatActions`,
      `${playerName}_HarvestActions`,
      `${playerName}_BuildActions`,
      `${playerName}_AdventureCards`,
      `${playerName}_ClaimedTiles`,
      `${playerName}_StarredTiles`,
      `${playerName}_TotalResourcesFromTiles`,
      `${playerName}_HasBlacksmith`,
      `${playerName}_HasMarket`,
      `${playerName}_HasChapel`,
      `${playerName}_HasMonastery`,
      `${playerName}_HasWarshipUpgrade`
    );
  }

  const rows: string[] = [headers.join(",")];

  // Generate data rows
  for (const turnStats of turnHistory) {
    const row: (string | number | boolean)[] = [turnStats.round];

    for (const playerName of playerNames) {
      const playerStats = turnStats.playerStats.find((p) => p.playerName === playerName);
      if (!playerStats) {
        // Fill with empty values if player data is missing
        for (let i = 0; i < 33; i++) {
          row.push("");
        }
        continue;
      }

      row.push(
        playerStats.fame,
        playerStats.might,
        playerStats.food,
        playerStats.wood,
        playerStats.ore,
        playerStats.gold,
        playerStats.championCount,
        playerStats.boatCount,
        playerStats.totalItems,
        playerStats.totalFollowers,
        playerStats.championVsChampionWins,
        playerStats.championVsChampionLosses,
        playerStats.championVsMonsterWins,
        playerStats.championVsMonsterLosses,
        playerStats.dragonEncounters,
        playerStats.marketInteractions,
        playerStats.blacksmithInteractions,
        playerStats.traderInteractions,
        playerStats.templeInteractions,
        playerStats.mercenaryInteractions,
        playerStats.championActions,
        playerStats.boatActions,
        playerStats.harvestActions,
        playerStats.buildActions,
        playerStats.adventureCards,
        playerStats.claimedTiles,
        playerStats.starredTiles,
        playerStats.totalResourcesFromTiles,
        playerStats.hasBlacksmith,
        playerStats.hasMarket,
        playerStats.hasChapel,
        playerStats.hasMonastery,
        playerStats.hasWarshipUpgrade
      );
    }

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

