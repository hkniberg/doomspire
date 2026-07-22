import { useState, useEffect, useCallback } from "react";
import { Tile } from "../lib/types";
import { GameState } from "../game/GameState";
import { DiceAction, TileAction } from "../lib/actionTypes";
import { hasAnyTileActions } from "../components/TileActionModal";
import { getChampionMovementBudget } from "../players/PlayerUtils";

interface UseMovementAndDiceReturn {
  selectedChampionId: number | null;
  championMovementPath: { row: number; col: number }[];
  diceValues: number[];
  usedDiceIndices: number[];
  selectedDieIndex: number | null;
  isDiceRolling: boolean;
  pendingChampionAction: {
    diceValue: number;
    championId: number;
    movementPath: { row: number; col: number }[];
    destinationTile: Tile;
  } | null;
  tileActionModalOpen: boolean;
  setSelectedChampionId: (id: number | null) => void;
  setChampionMovementPath: (path: { row: number; col: number }[]) => void;
  setDiceValues: (values: number[]) => void;
  setUsedDiceIndices: (indices: number[]) => void;
  setSelectedDieIndex: (index: number | null) => void;
  setIsDiceRolling: (rolling: boolean) => void;
  setPendingChampionAction: (action: {
    diceValue: number;
    championId: number;
    movementPath: { row: number; col: number }[];
    destinationTile: Tile;
  } | null) => void;
  setTileActionModalOpen: (open: boolean) => void;
  handleDieSelection: (dieIndex: number) => void;
  handleChampionSelection: (championId: number, gameState?: GameState) => void;
  handleTileClick: (row: number, col: number, gameState?: GameState) => void;
  handleMovementUndo: () => void;
  handleMovementCancel: () => void;
  handleMovementDone: (gameState?: GameState, resolver?: (action: DiceAction) => void, onAllDiceUsed?: () => void) => void;
  handleTileActionConfirm: (tileAction: TileAction, resolver?: (action: DiceAction) => void) => void;
  handleTileActionCancel: () => void;
  handleWASDMovement: (key: string, gameState?: GameState) => void;
  handleSaveDieForHarvest: (resolver?: (action: DiceAction) => void, onAllDiceUsed?: () => void) => void;
}

export function useMovementAndDice(): UseMovementAndDiceReturn {
  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(null);
  const [championMovementPath, setChampionMovementPath] = useState<{ row: number; col: number }[]>([]);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  const [usedDiceIndices, setUsedDiceIndices] = useState<number[]>([]);
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [pendingChampionAction, setPendingChampionAction] = useState<{
    diceValue: number;
    championId: number;
    movementPath: { row: number; col: number }[];
    destinationTile: Tile;
  } | null>(null);
  const [tileActionModalOpen, setTileActionModalOpen] = useState(false);

  const handleDieSelection = useCallback((dieIndex: number) => {
    if (usedDiceIndices.includes(dieIndex)) {
      return; // Can't select used die
    }

    if (selectedDieIndex === dieIndex) {
      // Deselect if clicking same die
      setSelectedDieIndex(null);
    } else {
      // Select new die
      setSelectedDieIndex(dieIndex);
      // Clear champion selection when selecting new die
      setSelectedChampionId(null);
      setChampionMovementPath([]);
    }
  }, [usedDiceIndices, selectedDieIndex]);

  const handleChampionSelection = useCallback((championId: number, gameState?: GameState) => {
    // Must have a die selected first
    if (selectedDieIndex === null) {
      return;
    }

    if (selectedChampionId === championId) {
      // Just deselect the champion (Done button will handle movement completion)
      setSelectedChampionId(null);
      setChampionMovementPath([]);
    } else {
      // Select new champion
      setSelectedChampionId(championId);
      if (gameState) {
        const champion = gameState.getChampion(
          gameState.getCurrentPlayer().name,
          championId,
        );
        if (champion) {
          setChampionMovementPath([champion.position]);
        }
      }
    }
  }, [selectedDieIndex, selectedChampionId]);

  const handleTileClick = useCallback((row: number, col: number, gameState?: GameState) => {
    // Tile clicking is not used for actions: movement is WASD-only, and harvest tiles
    // are chosen during the harvest phase (in the harvest modal), not the move phase.
    console.log("🎯 Tile clicked:", { row, col }, "- no tile click actions in the move phase");
  }, []);

  const handleMovementUndo = useCallback(() => {
    if (championMovementPath.length > 1) {
      // Remove the last position from the path
      setChampionMovementPath(championMovementPath.slice(0, -1));
    }
  }, [championMovementPath]);

  const handleMovementCancel = useCallback(() => {
    // Cancel entire movement and deselect champion
    console.log("❌ Canceling entire movement and deselecting champion");
    setSelectedChampionId(null);
    setChampionMovementPath([]);
  }, []);

  const handleMovementDone = useCallback((gameState?: GameState, resolver?: (action: DiceAction) => void, onAllDiceUsed?: () => void) => {
    if (
      selectedChampionId !== null &&
      championMovementPath.length >= 1 &&
      selectedDieIndex !== null &&
      gameState
    ) {
      const diceValue = diceValues[selectedDieIndex];
      const destinationPosition = championMovementPath[championMovementPath.length - 1];
      const destinationTile = gameState.board.getTileAt(destinationPosition);

      if (!destinationTile) {
        console.error("Invalid destination tile");
        return;
      }

      const currentPlayer = gameState.getCurrentPlayer();

      // Check if there are any available tile actions
      if (!hasAnyTileActions(gameState, destinationTile, currentPlayer, selectedChampionId)) {
        // No actions available, submit immediately with empty tile action
        if (resolver) {
          const action: DiceAction = {
            actionType: "championAction",
            championAction: {
              diceValueUsed: diceValue,
              championId: selectedChampionId,
              movementPathIncludingStartPosition: championMovementPath,
              tileAction: {}, // Empty tile action
            },
            reasoning: "Human player champion movement with no tile actions available",
          };

          // Mark die as used and reset state
          const newUsedDiceIndices = [...usedDiceIndices, selectedDieIndex];
          setUsedDiceIndices(newUsedDiceIndices);
          setSelectedDieIndex(null);
          setSelectedChampionId(null);
          setChampionMovementPath([]);

          // Resolve the action
          resolver(action);

          // Check if all dice are used and call callback
          if (newUsedDiceIndices.length >= diceValues.length && onAllDiceUsed) {
            onAllDiceUsed();
          }
        }
        return;
      }

      // Store the pending action and show tile action modal
      setPendingChampionAction({
        diceValue,
        championId: selectedChampionId,
        movementPath: championMovementPath,
        destinationTile,
      });
      setTileActionModalOpen(true);
    }
  }, [selectedChampionId, championMovementPath, selectedDieIndex, diceValues, usedDiceIndices]);

  const handleTileActionConfirm = useCallback((tileAction: TileAction, resolver?: (action: DiceAction) => void) => {
    if (pendingChampionAction && resolver) {
      const action: DiceAction = {
        actionType: "championAction",
        championAction: {
          diceValueUsed: pendingChampionAction.diceValue,
          championId: pendingChampionAction.championId,
          movementPathIncludingStartPosition: pendingChampionAction.movementPath,
          tileAction,
        },
        reasoning: "Human player champion movement with tile actions",
      };

      // Mark die as used and reset state
      setUsedDiceIndices([...usedDiceIndices, selectedDieIndex!]);
      setSelectedDieIndex(null);
      setSelectedChampionId(null);
      setChampionMovementPath([]);
      setPendingChampionAction(null);
      setTileActionModalOpen(false);

      // Resolve the action
      resolver(action);
    }
  }, [pendingChampionAction, usedDiceIndices, selectedDieIndex]);

  const handleTileActionCancel = useCallback(() => {
    setTileActionModalOpen(false);
    setPendingChampionAction(null);
    // Don't reset other state - let player continue moving or cancel movement manually
  }, []);

  const handleWASDMovement = useCallback((key: string, gameState?: GameState) => {
    if (championMovementPath.length === 0 || selectedDieIndex === null) {
      return;
    }

    const currentPos = championMovementPath[championMovementPath.length - 1];
    let newPos: { row: number; col: number } | null = null;

    switch (key.toLowerCase()) {
      case "w":
        newPos = { row: currentPos.row - 1, col: currentPos.col };
        break;
      case "s":
        newPos = { row: currentPos.row + 1, col: currentPos.col };
        break;
      case "a":
        newPos = { row: currentPos.row, col: currentPos.col - 1 };
        break;
      case "d":
        newPos = { row: currentPos.row, col: currentPos.col + 1 };
        break;
    }

    if (newPos && newPos.row >= 0 && newPos.row < 8 && newPos.col >= 0 && newPos.col < 8) {
      console.log("⌨️ WASD key pressed:", key, "Moving to:", newPos, "Current path:", championMovementPath);

      // Check if this position is already in the path (backtracking)
      const existingIndex = championMovementPath.findIndex(
        (pos) => pos.row === newPos.row && pos.col === newPos.col,
      );

      if (existingIndex !== -1) {
        console.log(
          "🔙 WASD Backtracking to index:",
          existingIndex,
          "Truncating path from",
          championMovementPath.length,
          "to",
          existingIndex + 1,
        );
        // Backtracking: truncate path to this position
        setChampionMovementPath(championMovementPath.slice(0, existingIndex + 1));
      } else {
        // Check if we can move forward (dice value restriction).
        // The budget accounts for Tailwind (+1 step) and the Abandoned Mule (max 2 steps per die).
        const selectedDieValue = diceValues[selectedDieIndex];
        const champion = gameState && selectedChampionId !== null
          ? gameState.getChampion(gameState.getCurrentPlayer().name, selectedChampionId)
          : undefined;
        const movementBudget = champion && gameState
          ? getChampionMovementBudget(champion, [selectedDieValue], gameState.fateEffects)
          : selectedDieValue;
        const currentPathLength = championMovementPath.length - 1; // Subtract 1 because first position is starting position

        if (currentPathLength >= movementBudget) {
          console.log(
            "❌ Cannot move further - movement budget reached:",
            movementBudget,
            "steps already taken:",
            currentPathLength,
          );
          return;
        }

        console.log(
          "➡️ WASD Moving forward to:",
          newPos,
          "Steps taken:",
          currentPathLength,
          "Dice value:",
          selectedDieValue,
        );
        // Moving forward: add new position to path
        setChampionMovementPath([...championMovementPath, newPos]);
      }
    }
  }, [championMovementPath, selectedDieIndex, diceValues, selectedChampionId]);

  // Save the selected die for the harvest phase (which tiles to harvest is decided then)
  const handleSaveDieForHarvest = useCallback((resolver?: (action: DiceAction) => void, onAllDiceUsed?: () => void) => {
    if (selectedDieIndex !== null && resolver) {
      const diceValue = diceValues[selectedDieIndex];

      const action: DiceAction = {
        actionType: "harvestAction",
        harvestAction: {
          diceValuesUsed: [diceValue],
        },
        reasoning: "Human player saved a die for the harvest phase",
      };

      // Mark die as used and reset state
      const newUsedDiceIndices = [...usedDiceIndices, selectedDieIndex];
      setUsedDiceIndices(newUsedDiceIndices);
      setSelectedDieIndex(null);
      setSelectedChampionId(null);
      setChampionMovementPath([]);

      // Resolve the action
      resolver(action);

      // Check if all dice are used and call callback
      if (newUsedDiceIndices.length >= diceValues.length && onAllDiceUsed) {
        onAllDiceUsed();
      }
    }
  }, [selectedDieIndex, diceValues, usedDiceIndices]);

  return {
    selectedChampionId,
    championMovementPath,
    diceValues,
    usedDiceIndices,
    selectedDieIndex,
    isDiceRolling,
    pendingChampionAction,
    tileActionModalOpen,
    setSelectedChampionId,
    setChampionMovementPath,
    setDiceValues,
    setUsedDiceIndices,
    setSelectedDieIndex,
    setIsDiceRolling,
    setPendingChampionAction,
    setTileActionModalOpen,
    handleDieSelection,
    handleChampionSelection,
    handleTileClick,
    handleMovementUndo,
    handleMovementCancel,
    handleMovementDone,
    handleTileActionConfirm,
    handleTileActionCancel,
    handleWASDMovement,
    handleSaveDieForHarvest,
  };
}
