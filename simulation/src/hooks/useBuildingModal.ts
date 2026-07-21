import { useState, useCallback } from "react";
import { getEligibleHarvestTiles } from "../engine/actions/harvestCalculator";
import { GameState } from "../game/GameState";
import { HarvestDecision } from "../lib/actionTypes";
import { GameLogEntry, Tile } from "../lib/types";

interface UseBuildingModalReturn {
  isBuildingModalOpen: boolean;
  buildingModalPlayerName: string | null; // The player the modal is currently open for (harvest phase runs in parallel, so this is not necessarily the "current player")
  savedDiceValues: number[]; // Dice the player saved for harvesting during the move phase
  eligibleHarvestTiles: Tile[]; // Tiles the player can currently harvest from
  openBuildingModal: (
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    playerName: string,
    savedDiceValues: number[]
  ) => Promise<HarvestDecision>;
  closeBuildingModal: () => void;
  handleBuildingDecision: (decision: HarvestDecision) => void;
}

export function useBuildingModal(): UseBuildingModalReturn {
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [buildingModalPlayerName, setBuildingModalPlayerName] = useState<string | null>(null);
  const [savedDiceValues, setSavedDiceValues] = useState<number[]>([]);
  const [eligibleHarvestTiles, setEligibleHarvestTiles] = useState<Tile[]>([]);
  const [buildingResolver, setBuildingResolver] = useState<((decision: HarvestDecision) => void) | null>(null);

  const openBuildingModal = useCallback((
    gameState: GameState,
    gameLog: readonly GameLogEntry[],
    playerName: string,
    diceValues: number[]
  ): Promise<HarvestDecision> => {
    return new Promise((resolve) => {
      setBuildingResolver(() => resolve);
      setBuildingModalPlayerName(playerName);
      setSavedDiceValues(diceValues);
      setEligibleHarvestTiles(getEligibleHarvestTiles(gameState, playerName));
      setIsBuildingModalOpen(true);
    });
  }, []);

  const closeBuildingModal = useCallback(() => {
    setIsBuildingModalOpen(false);
    setBuildingModalPlayerName(null);
    setSavedDiceValues([]);
    setEligibleHarvestTiles([]);
    setBuildingResolver(null);
  }, []);

  const handleBuildingDecision = useCallback((decision: HarvestDecision) => {
    if (buildingResolver) {
      buildingResolver(decision);
    }
    closeBuildingModal();
  }, [buildingResolver, closeBuildingModal]);

  return {
    isBuildingModalOpen,
    buildingModalPlayerName,
    savedDiceValues,
    eligibleHarvestTiles,
    openBuildingModal,
    closeBuildingModal,
    handleBuildingDecision,
  };
}
