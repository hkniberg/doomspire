import React, { useEffect, useRef, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuChevronsLeft,
  LuChevronsRight,
  LuPause,
  LuPlay,
  LuSkipBack,
} from "react-icons/lu";
import { MatchSnapshot } from "../lib/replayTypes";

interface ReplayControlsProps {
  snapshots: readonly MatchSnapshot[];
  /** Index of the snapshot being viewed, or null when showing the live game state */
  replayIndex: number | null;
  onReplayIndexChange: (index: number | null) => void;
  /** Whether a live game exists to return to (false when viewing a loaded recording) */
  allowLive: boolean;
}

const buttonStyle: React.CSSProperties = {
  padding: "6px 10px",
  backgroundColor: "#f8f9fa",
  color: "#2c3e50",
  border: "1px solid #dee2e6",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

/**
 * Timeline scrubber for stepping through recorded match snapshots.
 * Allows stepping per step or per round, auto-playing the replay,
 * and (during a live game) jumping back to the live state.
 */
export const ReplayControls: React.FC<ReplayControlsProps> = ({
  snapshots,
  replayIndex,
  onReplayIndexChange,
  allowLive,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const playTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastIndex = snapshots.length - 1;
  const isLive = replayIndex === null;
  const currentIndex = isLive ? lastIndex : Math.max(0, Math.min(replayIndex, lastIndex));
  const currentSnapshot = snapshots[currentIndex];

  // Auto-play: advance one snapshot per tick until the end is reached
  useEffect(() => {
    if (playTimeout.current) {
      clearTimeout(playTimeout.current);
      playTimeout.current = null;
    }
    if (!isPlaying) {
      return;
    }
    if (isLive || currentIndex >= lastIndex) {
      setIsPlaying(false);
      return;
    }
    playTimeout.current = setTimeout(() => {
      onReplayIndexChange(currentIndex + 1);
    }, playSpeed);
    return () => {
      if (playTimeout.current) {
        clearTimeout(playTimeout.current);
        playTimeout.current = null;
      }
    };
  }, [isPlaying, currentIndex, lastIndex, isLive, playSpeed, onReplayIndexChange]);

  if (snapshots.length === 0) {
    return null;
  }

  const stopPlaying = () => setIsPlaying(false);

  const goTo = (index: number) => {
    stopPlaying();
    onReplayIndexChange(Math.max(0, Math.min(index, lastIndex)));
  };

  const goLive = () => {
    stopPlaying();
    onReplayIndexChange(null);
  };

  const currentRound = currentSnapshot.gameState.currentRound;

  const goToPreviousRound = () => {
    // Jump to the first snapshot of the current round, or of the previous round
    // if already at the first snapshot of the current round
    const firstOfCurrentRound = snapshots.findIndex((s) => s.gameState.currentRound === currentRound);
    if (firstOfCurrentRound >= 0 && firstOfCurrentRound < currentIndex) {
      goTo(firstOfCurrentRound);
      return;
    }
    for (let i = currentIndex - 1; i >= 0; i--) {
      const round = snapshots[i].gameState.currentRound;
      if (round < currentRound) {
        const firstOfRound = snapshots.findIndex((s) => s.gameState.currentRound === round);
        goTo(firstOfRound >= 0 ? firstOfRound : i);
        return;
      }
    }
    goTo(0);
  };

  const goToNextRound = () => {
    for (let i = currentIndex + 1; i <= lastIndex; i++) {
      if (snapshots[i].gameState.currentRound > currentRound) {
        goTo(i);
        return;
      }
    }
    goTo(lastIndex);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Restart from the beginning if the replay is at the end (or live)
    if (isLive || currentIndex >= lastIndex) {
      onReplayIndexChange(0);
    }
    setIsPlaying(true);
  };

  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "12px 15px",
        backgroundColor: isLive ? "rgba(255, 255, 255, 0.8)" : "#fff8e1",
        borderRadius: "8px",
        border: isLive ? "1px solid #ddd" : "2px solid #f0ad4e",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontWeight: "bold", color: "#2c3e50", fontSize: "14px" }}>Replay:</span>

        <button style={buttonStyle} onClick={() => goTo(0)} title="Jump to start">
          <LuSkipBack size={14} />
        </button>
        <button style={buttonStyle} onClick={goToPreviousRound} title="Previous round">
          <LuChevronsLeft size={14} />
        </button>
        <button style={buttonStyle} onClick={() => goTo(currentIndex - 1)} title="Previous step">
          <LuChevronLeft size={14} />
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: isPlaying ? "#dc3545" : "#28a745", color: "white" }}
          onClick={togglePlay}
          title={isPlaying ? "Pause replay" : "Play replay"}
        >
          {isPlaying ? <LuPause size={14} /> : <LuPlay size={14} />}
        </button>
        <button style={buttonStyle} onClick={() => goTo(currentIndex + 1)} title="Next step">
          <LuChevronRight size={14} />
        </button>
        <button style={buttonStyle} onClick={goToNextRound} title="Next round">
          <LuChevronsRight size={14} />
        </button>

        <input
          type="range"
          min={0}
          max={lastIndex}
          value={currentIndex}
          onChange={(e) => goTo(Number(e.target.value))}
          style={{ flex: 1, minWidth: "150px", cursor: "pointer" }}
        />

        <span style={{ fontSize: "13px", color: "#495057", fontFamily: "monospace", whiteSpace: "nowrap" }}>
          {isLive ? "Live" : currentSnapshot.label} ({currentIndex + 1}/{snapshots.length})
        </span>

        <select
          value={playSpeed}
          onChange={(e) => setPlaySpeed(Number(e.target.value))}
          style={{ padding: "5px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px" }}
          title="Replay speed"
        >
          <option value={300}>Fast (0.3s)</option>
          <option value={1000}>Normal (1s)</option>
          <option value={2000}>Slow (2s)</option>
        </select>

        {allowLive && !isLive && (
          <button
            style={{ ...buttonStyle, backgroundColor: "#007bff", color: "white", fontWeight: "bold" }}
            onClick={goLive}
            title="Return to the live game state"
          >
            Live
          </button>
        )}
      </div>
    </div>
  );
};
