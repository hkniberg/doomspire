import { GameLogEntry, GameLogEntryType, GamePhase, Player } from "@/lib/types";
import React, { useEffect, useRef, useState } from "react";
import { LuCopy, LuDownload, LuMaximize2, LuMinimize2 } from "react-icons/lu";
import { PlayerFilter } from "./PlayerFilter";

interface GameLogProps {
  gameLog: GameLogEntry[];
  isVisible: boolean;
  players?: Player[];
  /** When set, log entries are clickable and report their index in the (unfiltered) game log */
  onEntryClick?: (entryIndex: number) => void;
  /** Keep the newest entry scrolled into view (used during replay scrubbing) */
  autoScrollToBottom?: boolean;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  fate: "Fate Phase",
  roll: "Roll Phase",
  move: "Move Phase",
  harvest: "Harvest Phase",
};

// A log entry paired with its index in the full (unfiltered) game log,
// so click-to-jump and expand state survive player filtering.
interface IndexedLogEntry {
  entry: GameLogEntry;
  index: number;
}

// A consecutive run of log entries with the same phase and player attribution.
// Table-wide entries (fate phase, roll phase) have no playerName, except fate-phase
// thinking entries, which are attributed to the player doing the thinking.
interface LogBlock {
  phase: GamePhase;
  playerName?: string;
  entries: { entry: GameLogEntry; key: number }[];
}

interface RoundGroup {
  round: number;
  blocks: LogBlock[];
}

// Group log entries sequentially: by round, then into consecutive blocks per phase and player.
// This preserves the actual order of events within a round.
function groupGameLogEntries(indexedEntries: IndexedLogEntry[]): RoundGroup[] {
  const rounds: RoundGroup[] = [];
  indexedEntries.forEach(({ entry, index }) => {
    let round = rounds[rounds.length - 1];
    if (!round || round.round !== entry.round) {
      round = { round: entry.round, blocks: [] };
      rounds.push(round);
    }
    let block = round.blocks[round.blocks.length - 1];
    if (!block || block.phase !== entry.phase || block.playerName !== entry.playerName) {
      block = { phase: entry.phase, playerName: entry.playerName, entries: [] };
      round.blocks.push(block);
    }
    block.entries.push({ entry, key: index });
  });
  return rounds;
}

// Helper function to format a single log entry without player name
function formatGameLogEntryContent(entry: GameLogEntry): string {
  const typeEmoji = getEntryEmoji(entry.type);
  return `${typeEmoji} ${entry.content}`;
}

// Helper function to get preview text for thinking entries
function getThinkingPreview(content: string, maxWords: number = 8): string {
  const words = content.split(" ");
  if (words.length <= maxWords) {
    return content;
  }
  return words.slice(0, maxWords).join(" ") + "...";
}

// Helper function to get emoji for entry type
function getEntryEmoji(type: GameLogEntryType): string {
  switch (type) {
    case "dice":
      return "🎲";
    case "movement":
      return "🚶";
    case "boat":
      return "⛵";
    case "exploration":
      return "🔍";
    case "combat":
      return "⚔️";
    case "harvest":
      return "🌾";
    case "assessment":
      return "🤔";
    case "event":
      return "📜";
    case "system":
      return "⚙️";
    case "victory":
      return "👑";
    case "thinking":
      return "💭";
    case "error":
      return "❌";
    default:
      return "📝";
  }
}

// Helper function to get color for entry type
function getEntryColor(type: GameLogEntryType): string {
  switch (type) {
    case "system":
      return "#2c3e50";
    case "assessment":
      return "#0c5460";
    case "movement":
    case "boat":
      return "#28a745";
    case "combat":
      return "#dc3545";
    case "harvest":
      return "#6f42c1";
    case "event":
      return "#fd7e14";
    case "exploration":
      return "#17a2b8";
    case "dice":
      return "#ffc107";
    case "victory":
      return "#e83e8c";
    case "thinking":
      return "#6c757d";
    case "error":
      return "#dc3545";
    default:
      return "#495057";
  }
}

export const GameLog: React.FC<GameLogProps> = ({
  gameLog,
  isVisible,
  players = [],
  onEntryClick,
  autoScrollToBottom = false,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the newest entry in view while replay scrubbing reveals entries
  useEffect(() => {
    if (autoScrollToBottom && isVisible && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [autoScrollToBottom, isVisible, gameLog.length]);

  if (!isVisible || gameLog.length === 0) {
    return null;
  }

  // Filter game log entries based on selected player, keeping each entry's original index.
  // Table-wide entries (no playerName, e.g. fate and roll phase) are always included for context.
  const indexedGameLog: IndexedLogEntry[] = gameLog.map((entry, index) => ({ entry, index }));
  const filteredGameLog = selectedPlayer
    ? indexedGameLog.filter(({ entry }) => entry.playerName === undefined || entry.playerName === selectedPlayer)
    : indexedGameLog;

  const convertToMarkdown = (): string => {
    let markdown = "# Game Log\n\n";
    // Filter out thinking entries from markdown export
    const filteredGameLogForExport = filteredGameLog.filter(({ entry }) => entry.type !== "thinking");
    const groupedEntries = groupGameLogEntries(filteredGameLogForExport);

    groupedEntries.forEach(({ round, blocks }) => {
      markdown += `## Round ${round}\n\n`;

      let previousPhase: GamePhase | null = null;
      blocks.forEach(({ phase, playerName, entries }) => {
        if (phase !== previousPhase) {
          markdown += `### ${PHASE_LABELS[phase]}\n\n`;
          previousPhase = phase;
        }
        if (playerName) {
          markdown += `#### ${playerName}\n\n`;
        }

        entries.forEach(({ entry }) => {
          const typeEmoji = getEntryEmoji(entry.type);
          const content = entry.content;

          if (entry.type === "assessment") {
            // Use blockquote for assessment entries that may have multiple lines
            // Split content by lines and prefix each line with > to maintain blockquote
            const lines = content.split("\n");
            lines.forEach((line, index) => {
              if (index === 0) {
                markdown += `> ${typeEmoji} ${line}\n`;
              } else {
                markdown += `> ${line}\n`;
              }
            });
            markdown += "\n";
          } else {
            markdown += `- ${typeEmoji} ${content}\n`;
          }
        });

        markdown += "\n";
      });
    });

    return markdown;
  };

  const handleCopy = async () => {
    try {
      const markdown = convertToMarkdown();
      await navigator.clipboard.writeText(markdown);
      alert("Game log copied to clipboard as markdown!");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    const markdown = convertToMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `game-log-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buttonStyle = {
    padding: "6px 8px",
    margin: "0 2px",
    backgroundColor: "transparent",
    color: "#6c757d",
    border: "1px solid #dee2e6",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s ease",
  };

  const containerStyle = {
    marginBottom: "20px",
    padding: "15px",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: "8px",
    border: "1px solid #ddd",
    maxHeight: isMaximized ? "80vh" : "400px",
    maxWidth: isMaximized ? undefined : "1000px",
    overflowY: "auto" as const,
    position: isMaximized ? ("fixed" as const) : ("relative" as const),
    top: isMaximized ? "10vh" : "auto",
    left: isMaximized ? "10vw" : "auto",
    width: isMaximized ? "80vw" : "auto",
    zIndex: isMaximized ? 1000 : "auto",
  };

  const groupedEntries = groupGameLogEntries(filteredGameLog);

  return (
    <div ref={containerRef} style={containerStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ margin: 0, color: "#2c3e50" }}>📋 Game Log</h3>
          {players.length > 0 && (
            <PlayerFilter players={players} selectedPlayer={selectedPlayer} onPlayerFilterChange={setSelectedPlayer} />
          )}
        </div>
        <div>
          <button
            style={{
              ...buttonStyle,
              backgroundColor: isMaximized ? "#f8f9fa" : "transparent",
            }}
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Minimize" : "Maximize"}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isMaximized ? "#f8f9fa" : "transparent")}
          >
            {isMaximized ? <LuMinimize2 size={16} /> : <LuMaximize2 size={16} />}
          </button>
          <button
            style={buttonStyle}
            onClick={handleCopy}
            title="Copy as Markdown"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <LuCopy size={16} />
          </button>
          <button
            style={buttonStyle}
            onClick={handleDownload}
            title="Download as Markdown"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <LuDownload size={16} />
          </button>
        </div>
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "12px",
          lineHeight: "1.4",
        }}
      >
        {groupedEntries.map(({ round, blocks }) => {
          let previousPhase: GamePhase | null = null;
          return (
            <div
              key={round}
              style={{
                marginBottom: "15px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
                border: "1px solid #e9ecef",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  color: "#2c3e50",
                  marginBottom: "8px",
                  fontSize: "14px",
                }}
              >
                🎲 Round {round}
              </div>
              {blocks.map(({ phase, playerName, entries }, blockIndex) => {
                const showPhaseHeading = phase !== previousPhase;
                previousPhase = phase;
                return (
                  <div key={blockIndex} style={{ marginBottom: "8px" }}>
                    {showPhaseHeading && (
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#2c3e50",
                          marginBottom: "4px",
                          fontSize: "13px",
                          borderBottom: "1px solid #dee2e6",
                          paddingBottom: "2px",
                        }}
                      >
                        {PHASE_LABELS[phase]}
                      </div>
                    )}
                    {playerName && (
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#495057",
                          marginBottom: "4px",
                          marginLeft: "8px",
                          fontSize: "13px",
                        }}
                      >
                        {playerName}:
                      </div>
                    )}
                    {entries.map(({ entry, key: entryKey }) => {
                      const isThinking = entry.type === "thinking";
                      const isExpanded = expandedThinking.has(entryKey);
                      const indent = playerName ? "24px" : "16px";

                      const clickableProps = onEntryClick
                        ? {
                            onClick: () => onEntryClick(entryKey),
                            title: "Jump replay to this point",
                          }
                        : {};
                      const clickableStyle: React.CSSProperties = onEntryClick ? { cursor: "pointer" } : {};

                      const toggleExpanded = (event: React.MouseEvent) => {
                        event.stopPropagation();
                        const newExpanded = new Set(expandedThinking);
                        if (isExpanded) {
                          newExpanded.delete(entryKey);
                        } else {
                          newExpanded.add(entryKey);
                        }
                        setExpandedThinking(newExpanded);
                      };

                      if (isThinking) {
                        const preview = getThinkingPreview(entry.content);
                        const typeEmoji = getEntryEmoji(entry.type);
                        return (
                          <div
                            key={entryKey}
                            {...clickableProps}
                            style={{
                              marginBottom: "2px",
                              marginLeft: indent,
                              color: getEntryColor(entry.type),
                              fontStyle: "italic",
                              whiteSpace: isExpanded ? "pre-wrap" : "normal",
                              ...clickableStyle,
                            }}
                          >
                            <span>
                              {typeEmoji} {isExpanded ? entry.content : preview}
                            </span>
                            {entry.content.split(" ").length > 8 && (
                              <button
                                onClick={toggleExpanded}
                                style={{
                                  marginLeft: "8px",
                                  padding: "2px 6px",
                                  fontSize: "10px",
                                  backgroundColor: "transparent",
                                  color: "#6c757d",
                                  border: "1px solid #6c757d",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                }}
                              >
                                {isExpanded ? "less" : "more"}
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        const formattedEntry = formatGameLogEntryContent(entry);
                        return (
                          <div
                            key={entryKey}
                            {...clickableProps}
                            style={{
                              marginBottom: "2px",
                              marginLeft: indent,
                              color: getEntryColor(entry.type),
                              fontStyle: entry.type === "assessment" ? "italic" : "normal",
                              fontWeight: entry.type === "system" ? "bold" : "normal",
                              ...clickableStyle,
                            }}
                          >
                            {formattedEntry}
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
