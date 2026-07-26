// Lords of Doomspire Claude AI Player

import { getTraderItemById } from "@/content/traderItems";
import { getEligibleHarvestTiles } from "@/engine/actions/harvestCalculator";
import { formatBuildingInfo, stringifyGameState, stringifyPlayer } from "@/game/gameStateStringifier";
import { DiceAction, HarvestDecision } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Decision, DecisionContext, GameLogEntry, Player, PlayerType, ResourceType, TurnContext } from "@/lib/types";
import { GameState } from "../game/GameState";
import { decisionSchema, diceActionSchema, harvestDecisionSchema, traderDecisionSchema } from "../lib/claudeSchemas";
import { GameSettings } from "../lib/GameSettings";
import { TemplateProcessor, TemplateVariables } from "../lib/templateProcessor";
import { Claude } from "../llm/claude";
import { PlayerAgent } from "./PlayerAgent";
import { getUsableBuildings, prefixThinkingWithPlayerName } from "./PlayerUtils";

export class ClaudePlayerAgent implements PlayerAgent {
    private name: string;
    private claude: Claude;
    private templateProcessor: TemplateProcessor;

    constructor(name: string, claude: Claude, templateProcessor: TemplateProcessor) {
        this.name = name;
        this.claude = claude;
        this.templateProcessor = templateProcessor;
    }

    getName(): string {
        return this.name;
    }

    getType(): PlayerType {
        return "claude";
    }


    async makeStrategicAssessment(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        diceValues: number[],
        turnNumber: number,
        traderItems: readonly TraderCard[],
        thinkingLogger?: (content: string) => void,
    ): Promise<string | undefined> {
        const userMessage = await this.prepareAssessmentMessage(gameState, gameLog, diceValues, turnNumber, traderItems);

        // Get text response for strategic assessment
        const strategicAssessment = await this.claude.useClaude(userMessage, undefined, 6000, prefixThinkingWithPlayerName(this.name, thinkingLogger));

        return strategicAssessment.trim() || undefined;
    }

    async decideDiceAction(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
        thinkingLogger?: (content: string) => void,
    ): Promise<DiceAction> {
        // Prepare the user message with current context
        const userMessage = await this.prepareDiceActionMessage(gameState, gameLog, turnContext);

        // Get LLM response with structured JSON
        const response = await this.claude.useClaude(userMessage, diceActionSchema, 3000, prefixThinkingWithPlayerName(this.name, thinkingLogger));

        const action = response as DiceAction;

        // Defensive check: the schema requires a payload matching the actionType,
        // but fail with a clear message if the response is somehow malformed anyway
        const payload = action.actionType === "championAction" ? action.championAction
            : action.actionType === "boatAction" ? action.boatAction
                : action.actionType === "harvestAction" ? action.harvestAction
                    : undefined;
        if (!payload) {
            throw new Error(`Claude returned actionType "${action.actionType}" without a matching payload: ${JSON.stringify(action)}`);
        }

        return action;
    }

    async makeDecision(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
        thinkingLogger?: (content: string) => void,
    ): Promise<Decision> {
        // If there's only one option, choose it automatically without AI
        if (decisionContext.options.length === 1) {
            return { choice: decisionContext.options[0].id };
        }

        // Prepare decision context message
        const userMessage = await this.prepareDecisionMessage(gameState, gameLog, decisionContext);

        // Constrain the choice to the exact option ids, so the model cannot answer with
        // e.g. an option number or a differently-cased name (structured outputs enforce the enum)
        const validChoices = decisionContext.options.map(opt => opt.id);
        const schema = {
            ...decisionSchema,
            properties: {
                ...decisionSchema.properties,
                choice: {
                    type: "string",
                    enum: validChoices,
                    description: "The id of the chosen option"
                }
            }
        };

        // Get structured JSON response for decision
        const response = await this.claude.useClaude(userMessage, schema, 2000, prefixThinkingWithPlayerName(this.name, thinkingLogger));

        // Validate that the chosen option is valid (should be guaranteed by the enum)
        if (!validChoices.includes(response.choice)) {
            throw new Error(`Invalid choice: ${response.choice}. Valid options: ${validChoices.join(', ')}`);
        }

        return response as Decision;
    }

    async makeTraderDecision(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
        thinkingLogger?: (content: string) => void,
    ): Promise<TraderDecision> {
        // Prepare trader decision context message
        const userMessage = await this.prepareTraderDecisionMessage(gameState, gameLog, traderContext);

        // Get structured JSON response for trader decision
        const response = await this.claude.useClaude(userMessage, traderDecisionSchema, 3000, prefixThinkingWithPlayerName(this.name, thinkingLogger));

        return response as TraderDecision;
    }

    async makeHarvestDecision(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
        thinkingLogger?: (content: string) => void,
    ): Promise<HarvestDecision> {
        const player = gameState.getPlayer(playerName);
        if (!player) {
            throw new Error(`Player with name ${playerName} not found`);
        }

        // Check for usable buildings and available build actions early
        const usableBuildings = getUsableBuildings(player);
        const availableBuildActions = this.getAvailableBuildActions(player, player.resources);

        // The build action is paid after the harvest is collected, so also list build actions
        // that could become affordable with this round's harvest yield.
        const potentialResources = this.getPotentialResourcesAfterHarvest(gameState, playerName, savedDiceValues);
        const potentialBuildActions = this.getAvailableBuildActions(player, potentialResources)
            .filter((action) => !availableBuildActions.includes(action));

        if (savedDiceValues.length === 0 && usableBuildings.length === 0 && availableBuildActions.length === 0) {
            // Nothing to harvest, no buildings to use, and no build actions available
            return {};
        }

        const userMessage = await this.prepareHarvestDecisionMessage(gameState, gameLog, playerName, savedDiceValues, usableBuildings, availableBuildActions, potentialBuildActions);

        // Get structured JSON response for the harvest phase decision
        const response = await this.claude.useClaude(userMessage, harvestDecisionSchema, 3000, prefixThinkingWithPlayerName(this.name, thinkingLogger));

        return response as HarvestDecision;
    }

    private async prepareAssessmentMessage(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        diceRolls: number[],
        turnNumber: number,
        traderItems: readonly TraderCard[],
    ): Promise<string> {
        const boardState = stringifyGameState(gameState);
        const gameLogText = this.formatGameLogForPrompt(gameLog, false, false);

        // Format trader items for the template
        const itemCounts = traderItems.reduce((acc, traderCard) => {
            acc[traderCard.id] = (acc[traderCard.id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const traderItemsText = Object.entries(itemCounts)
            .map(([itemId, quantity], i) => {
                const item = getTraderItemById(itemId);
                if (!item) {
                    return `${i + 1}. Unknown item (ID: ${itemId}) - Quantity: ${quantity}`;
                }
                return `${i + 1}. ${item.name} (${item.cost} gold) - ${item.description}`;
            })
            .join("\n");

        const traderItemsSection = traderItemsText
            ? `\nTrader Items Available:\n${traderItemsText}`
            : "\nTrader Items Available: None";

        const variables: TemplateVariables = {
            playerName: this.name,
            boardState: boardState,
            gameLog: gameLogText,
            diceValues: diceRolls.join(", "),
            turnNumber: turnNumber,
            extraInstructions: this.getExtraInstructionsSection(gameState),
            traderItems: traderItemsSection,
        };

        return await this.templateProcessor.processTemplate("strategicAssessment", variables);
    }

    private async prepareDiceActionMessage(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        turnContext: TurnContext,
    ): Promise<string> {

        // Use the readable stringified game state
        const boardState = stringifyGameState(gameState);

        // Format the game log into readable text
        const gameLogText = this.formatGameLogForPrompt(gameLog, true, true);

        // If the previous action was rejected as invalid, tell the model why so it can correct itself
        const previousErrorSection = turnContext.previousError
            ? `\n<previous-action-rejected>\nYour previous dice action was rejected as invalid: ${turnContext.previousError}\nChoose a different, legal action.\n</previous-action-rejected>\n`
            : "";

        const variables: TemplateVariables = {
            playerName: this.name,
            gameLog: gameLogText,
            boardState: boardState,
            turnNumber: turnContext.turnNumber,
            remainingDice: turnContext.remainingDiceValues.join(", "),
            previousError: previousErrorSection,
            foodTaxReminder: this.buildFoodTaxReminder(gameState),
            extraInstructions: this.getExtraInstructionsSection(gameState)
        };

        return await this.templateProcessor.processTemplate("diceAction", variables);
    }

    private async prepareDecisionMessage(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        decisionContext: DecisionContext,
    ): Promise<string> {
        // Use this agent's own name, NOT gameState.getCurrentPlayer(): decisions can be
        // requested outside this player's turn (fate card votes, blocking decisions,
        // combat support), where the current player is someone else.
        const gameLogText = this.formatGameLogForPrompt(gameLog, true, true);
        const boardState = stringifyGameState(gameState);

        // List options by id (no numbering - a numbered list tempts the model to answer with the number)
        const optionsText = decisionContext.options.map((option) => `- "${option.id}": ${option.description}`).join("\n");

        const variables: TemplateVariables = {
            playerName: this.name,
            description: decisionContext.description,
            options: optionsText,
            boardState: boardState,
            gameLog: gameLogText,
            extraInstructions: this.getExtraInstructionsSection(gameState),
        };

        return await this.templateProcessor.processTemplate("makeDecision", variables);
    }

    private async prepareTraderDecisionMessage(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        traderContext: TraderContext,
    ): Promise<string> {
        // Use this agent's own player, not getCurrentPlayer(), for safety outside own turn
        const player = gameState.getPlayer(this.name);
        if (!player) {
            throw new Error(`Player with name ${this.name} not found`);
        }
        const gameLogText = this.formatGameLogForPrompt(gameLog, true, true);
        const playerStatus = stringifyPlayer(player, gameState);

        // Format player resources
        const resourcesText = Object.entries(traderContext.playerResources)
            .map(([resource, amount]) => `${resource}: ${amount}`)
            .join(", ");

        // Format available items (group duplicates and show quantities)
        const itemCounts = traderContext.availableItems.reduce((acc, traderCard) => {
            acc[traderCard.id] = (acc[traderCard.id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const itemsText = Object.entries(itemCounts)
            .map(([itemId, quantity], i) => {
                const item = getTraderItemById(itemId);
                if (!item) {
                    return `${i + 1}. Unknown item (ID: ${itemId}) - Quantity: ${quantity}`;
                }
                const quantityText = quantity > 1 ? ` - Quantity: ${quantity}` : "";
                return `${i + 1}. ${item.name} (ID: ${item.id}) - Cost: ${item.cost} gold${quantityText} - ${item.description}`;
            })
            .join("\n");

        const variables: TemplateVariables = {
            playerName: player.name,
            description: traderContext.description,
            playerResources: resourcesText,
            availableItems: itemsText,
            playerStatus: playerStatus,
            gameLog: gameLogText,
            extraInstructions: this.getExtraInstructionsSection(gameState),
        };

        return await this.templateProcessor.processTemplate("traderDecision", variables);
    }

    private async prepareHarvestDecisionMessage(
        gameState: GameState,
        gameLog: readonly GameLogEntry[],
        playerName: string,
        savedDiceValues: number[],
        usableBuildings: string[],
        availableBuildActions: string[],
        potentialBuildActions: string[],
    ): Promise<string> {
        const player = gameState.getPlayer(playerName);
        if (!player) {
            throw new Error(`Player with name ${playerName} not found`);
        }

        const boardState = stringifyGameState(gameState);
        const gameLogText = this.formatGameLogForPrompt(gameLog, true, true);
        const playerStatus = stringifyPlayer(player, gameState);

        // Build the harvest options summary
        const harvestInfo = this.buildHarvestInfoSummary(gameState, playerName, savedDiceValues);

        // Build available buildings summary
        const availableBuildings = this.buildAvailableBuildingsSummary(player, usableBuildings);

        // Build available build actions summary
        const currentBuildActionsText = availableBuildActions.length > 0
            ? `You can currently afford these build actions: ${availableBuildActions.join(", ")}.`
            : "You cannot afford any build actions with your current resources.";
        const potentialBuildActionsText = potentialBuildActions.length > 0
            ? ` After harvesting, these may also become affordable: ${potentialBuildActions.join(", ")}. The build action is paid after your harvest is collected - make sure your chosen harvest tiles actually cover the cost.`
            : "";
        const buildActionsText = currentBuildActionsText + potentialBuildActionsText;

        const variables: TemplateVariables = {
            playerName: player.name,
            boardState: boardState,
            gameLog: gameLogText,
            playerStatus: playerStatus,
            harvestInfo: harvestInfo,
            availableBuildings: availableBuildings,
            availableBuildActions: buildActionsText,
            foodTaxReminder: this.buildFoodTaxReminder(gameState),
            extraInstructions: this.getExtraInstructionsSection(gameState),
        };

        return await this.templateProcessor.processTemplate("useBuilding", variables);
    }

    private buildHarvestInfoSummary(gameState: GameState, playerName: string, savedDiceValues: number[]): string {
        if (savedDiceValues.length === 0) {
            return "You saved no dice for harvesting, so you cannot harvest this round. Leave harvestTiles empty.";
        }

        const diceSum = savedDiceValues.reduce((sum, value) => sum + value, 0);
        const diceString = savedDiceValues.map(die => `[${die}]`).join("+");
        const eligibleTiles = getEligibleHarvestTiles(gameState, playerName);

        if (eligibleTiles.length === 0) {
            return `You saved dice ${diceString} for harvesting, but there are no tiles you can currently harvest from. Leave harvestTiles empty.`;
        }

        const tileLines = eligibleTiles.map(tile => {
            const yields = Object.entries(tile.resources || {})
                .filter(([, amount]) => (amount || 0) > 0)
                .map(([resource, amount]) => `${amount} ${resource}`)
                .join(" + ");
            return `- (${tile.position.row}, ${tile.position.col}): ${yields}`;
        });

        return [
            `You saved dice ${diceString} (total value ${diceSum}) for harvesting.`,
            `You may harvest from up to ${diceSum} different tiles. Eligible tiles:`,
            ...tileLines,
            `Set harvestTiles to the positions of the tiles you want to harvest from.`,
        ].join("\n");
    }

    private buildAvailableBuildingsSummary(player: Player, usableBuildings: string[]): string {
        const buildingSummaries: string[] = [];

        // Check for Blacksmith
        if (player.buildings.includes("blacksmith")) {
            const canUseBlacksmith = usableBuildings.includes("blacksmith");
            const status = canUseBlacksmith ? "Available" : "Cannot use (need 1 Gold + 3 Ore)";
            buildingSummaries.push(`- ${formatBuildingInfo("blacksmith")}: ${status}`);
        }

        // Check for Market
        if (player.buildings.includes("market")) {
            const canUseMarket = usableBuildings.includes("market");
            const status = canUseMarket ? "Available" : "Cannot use (no resources to sell)";
            buildingSummaries.push(`- ${formatBuildingInfo("market")}: ${status}`);
        }

        // Check for Fletcher
        if (player.buildings.includes("fletcher")) {
            const canUseFletcher = usableBuildings.includes("fletcher");
            const status = canUseFletcher ? "Available" : "Cannot use (need 3 Wood + 1 Ore)";
            buildingSummaries.push(`- ${formatBuildingInfo("fletcher")}: ${status}`);
        }

        if (buildingSummaries.length === 0) {
            return "You have no buildings.";
        }

        return buildingSummaries.join("\n");
    }

    /**
     * List the build actions the player could perform with the given resource pool.
     * The pool is a parameter (rather than always player.resources) because the build
     * action is paid after the harvest is collected, so we also want to check
     * affordability against the potential post-harvest resources.
     */
    private getAvailableBuildActions(player: Player, resources: Record<ResourceType, number>): string[] {
        const affords = (cost: Record<ResourceType, number>): boolean =>
            resources.food >= cost.food && resources.wood >= cost.wood && resources.ore >= cost.ore && resources.gold >= cost.gold;

        const availableActions: string[] = [];

        // Check Blacksmith (2 Food + 2 Ore, max 1 per player)
        const hasBlacksmith = player.buildings.includes("blacksmith");
        if (!hasBlacksmith && affords(GameSettings.BLACKSMITH_COST)) {
            availableActions.push("blacksmith");
        }

        // Check Market (2 Food + 2 Wood, max 1 per player)
        const hasMarket = player.buildings.includes("market");
        if (!hasMarket && affords(GameSettings.MARKET_COST)) {
            availableActions.push("market");
        }

        // Check Fletcher (1 Wood + 1 Food + 1 Gold + 1 Ore, max 1 per player)
        const hasFletcher = player.buildings.includes("fletcher");
        if (!hasFletcher && affords(GameSettings.FLETCHER_COST)) {
            availableActions.push("fletcher");
        }

        // Check Chapel (6 Wood + 2 Gold, only once per player)
        const hasChapel = player.buildings.includes("chapel");
        const hasMonastery = player.buildings.includes("monastery");
        if (!hasChapel && !hasMonastery && affords(GameSettings.CHAPEL_COST)) {
            availableActions.push("chapel");
        }

        // Check Monastery upgrade (8 Wood + 3 Gold + 1 Ore, requires chapel)
        if (hasChapel && !hasMonastery && affords(GameSettings.MONASTERY_COST)) {
            availableActions.push("upgradeChapelToMonastery");
        }

        // Check Champion recruitment (max 3 total)
        const currentChampionCount = player.champions.length;
        if (currentChampionCount < GameSettings.MAX_CHAMPIONS_PER_PLAYER) {
            if (affords(GameSettings.CHAMPION_COST)) {
                availableActions.push("recruitChampion");
            }
        }

        // Check Boat building (max 2 boats total)
        const currentBoatCount = player.boats.length;
        if (currentBoatCount < GameSettings.MAX_BOATS_PER_PLAYER && affords(GameSettings.BOAT_COST)) {
            availableActions.push("buildBoat");
        }

        // Check Warship upgrade (2 Wood + 1 Ore + 1 Gold, max 1 per player)
        const hasWarshipUpgrade = player.buildings.includes("warshipUpgrade");
        if (!hasWarshipUpgrade && affords(GameSettings.WARSHIP_UPGRADE_COST)) {
            availableActions.push("warshipUpgrade");
        }

        return availableActions;
    }

    /**
     * The player's resources plus the total yield of all eligible harvest tiles this round.
     * An optimistic upper bound: if the player has fewer saved dice than eligible tiles,
     * not all of them can actually be harvested. The prompt warns the AI about this.
     */
    private getPotentialResourcesAfterHarvest(
        gameState: GameState,
        playerName: string,
        savedDiceValues: number[],
    ): Record<ResourceType, number> {
        const player = gameState.getPlayer(playerName)!;
        const potential: Record<ResourceType, number> = { ...player.resources };

        if (savedDiceValues.length === 0) {
            return potential;
        }

        // Bountiful Harvest fate card doubles all harvest yields
        const multiplier = gameState.fateEffects.doubleHarvest ? 2 : 1;

        for (const tile of getEligibleHarvestTiles(gameState, playerName)) {
            for (const [resource, amount] of Object.entries(tile.resources || {})) {
                potential[resource as ResourceType] += (amount || 0) * multiplier;
            }
        }

        return potential;
    }

    /**
     * A concrete reminder about next round's dice food tax, so the AI doesn't sell or
     * spend down its food and then lose dice (a recurring AI failure in playtests).
     */
    private buildFoodTaxReminder(gameState: GameState): string {
        const player = gameState.getPlayer(this.name);
        if (!player) {
            return "";
        }

        const knightCount = player.champions.length;
        const totalDice = 1 + knightCount;
        const taxMultiplier = gameState.doubleFoodTaxNextRound ? 2 : 1;
        const taxPerDie = GameSettings.DICE_TAX_FOOD_PER_DIE * taxMultiplier;
        const taxedDice = Math.max(0, totalDice - GameSettings.FREE_DICE_COUNT);
        const foodCost = taxedDice * taxPerDie;

        if (foodCost === 0) {
            return `Food tax reminder: with ${knightCount} knight(s) you roll ${totalDice} dice next round, all free (no food tax).`;
        }

        const doubledNote = taxMultiplier > 1 ? ", doubled next round by Blessing of the Lonesome" : "";
        return `Food tax reminder: with ${knightCount} knight(s) you roll ${totalDice} dice next round. ` +
            `The first ${GameSettings.FREE_DICE_COUNT} are free; the other ${taxedDice} cost ${taxPerDie} food each ` +
            `(${foodCost} food total${doubledNote}). You currently have ${player.resources.food} food - ` +
            `if you end this round with less than ${foodCost} food, you will lose dice next round.`;
    }

    private getExtraInstructionsSection(gameState: GameState): string {
        const player = gameState.getPlayer(this.name);
        if (!player) {
            throw new Error(`Player with name ${this.name} not found`);
        }

        return player.extraInstructions?.trim()
            ? `\n<additional-instructions-provided-by-human-player>\n${player.extraInstructions.trim()}\n</additional-instructions-provided-by-human-player>\n`
            : "";
    }


    private formatGameLogForPrompt(gameLog: readonly GameLogEntry[], onlyThisRound: boolean = false, onlyMe: boolean = false): string {
        if (gameLog.length === 0) {
            return "No game events yet.";
        }

        // Determine current round
        const currentRound = Math.max(...gameLog.map(entry => entry.round));
        const previousRound = currentRound - 1;

        // Filter entries based on the rules and new parameters:
        const filteredEntries = gameLog.filter(entry => {
            // Always exclude thinking entries
            if (entry.type === "thinking") {
                return false;
            }

            // Always exclude other players' assessments
            if (entry.type === "assessment" && entry.playerName !== this.name) {
                return false;
            }

            // If onlyMe is true, only include this player's entries (plus table-wide entries like fate cards)
            if (onlyMe && entry.playerName !== undefined && entry.playerName !== this.name) {
                return false;
            }

            // If onlyThisRound is true, only include current round
            if (onlyThisRound && entry.round !== currentRound) {
                return false;
            }

            // Original filtering logic (when not overridden by new parameters)
            if (!onlyThisRound) {
                if (entry.round >= previousRound) {
                    // Recent rounds: include all entries (assessments already filtered above)
                    return true;
                } else {
                    // Earlier rounds: only include this player's entries (table-wide entries are dropped)
                    return entry.playerName === this.name;
                }
            }

            return true;
        });

        // Group by round and format readably
        const logByRound = filteredEntries.reduce(
            (acc, entry) => {
                if (!acc[entry.round]) {
                    acc[entry.round] = [];
                }
                acc[entry.round].push(entry);
                return acc;
            },
            {} as Record<number, GameLogEntry[]>,
        );

        const formattedRounds = Object.entries(logByRound)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([round, entries]) => {
                const roundNumber = parseInt(round);
                const roundEntries = entries.map((entry) => `  ${entry.playerName ?? "(all players)"}: ${entry.content}`).join("\n");

                // Add clarification when we're only showing this player's entries (earlier rounds or onlyMe mode)
                const isFilteredRound = roundNumber < previousRound || onlyMe;
                const roundHeader = isFilteredRound
                    ? `Round ${round} (only showing ${this.name}):`
                    : `Round ${round}:`;

                return `${roundHeader}\n${roundEntries}`;
            });

        return formattedRounds.join("\n\n");
    }
}
