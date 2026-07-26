// Lords of Doomspire Claude AI Player

import { getTraderItemById } from "@/content/traderItems";
import { getEligibleHarvestTiles } from "@/engine/actions/harvestCalculator";
import { getEffectiveBuildCost } from "@/engine/handlers/buildActionHandler";
import { getAffordableBuildActions } from "@/engine/handlers/buildingUsageHandler";
import { stringifyGameState, stringifyPlayer, stringifyStandings } from "@/game/gameStateStringifier";
import { DiceAction, HarvestDecision } from "@/lib/actionTypes";
import { TraderCard } from "@/lib/cards";
import { TraderContext, TraderDecision } from "@/lib/traderTypes";
import { Decision, DecisionContext, GameLogEntry, Player, PlayerType, ResourceType, TurnContext } from "@/lib/types";
import { formatCost, formatPosition, formatResources } from "@/lib/utils";
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

        // Skip the API call when there is provably nothing to decide. Affordability is exact
        // here (and only here): with no saved dice there is no harvest income, so the current
        // stockpile is already final for this round.
        if (savedDiceValues.length === 0
            && getUsableBuildings(player).length === 0
            && getAffordableBuildActions(player, gameState).length === 0) {
            return {};
        }

        const userMessage = await this.prepareHarvestDecisionMessage(gameState, gameLog, playerName, savedDiceValues);

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
    ): Promise<string> {
        const player = gameState.getPlayer(playerName);
        if (!player) {
            throw new Error(`Player with name ${playerName} not found`);
        }

        const variables: TemplateVariables = {
            playerName: player.name,
            gameLog: this.formatGameLogForPrompt(gameLog, true, true),
            playerStatus: this.buildHarvestPlayerSummary(player),
            standings: stringifyStandings(gameState, player.name),
            harvestPhaseSteps: this.buildHarvestPhaseSteps(gameState, player, savedDiceValues),
            foodTaxReminder: this.buildFoodTaxReminder(gameState),
            extraInstructions: this.getExtraInstructionsSection(gameState),
        };

        return await this.templateProcessor.processTemplate("useBuilding", variables);
    }

    /**
     * A harvest-specific player summary. Deliberately much smaller than stringifyPlayer:
     * knight positions, items, followers and boats have no bearing on any harvest sub-decision,
     * and the claimed tile list is restated by the harvest step below.
     */
    private buildHarvestPlayerSummary(player: Player): string {
        const knightCount = player.champions.length;
        const buildings = player.buildings.length > 0 ? player.buildings.join(", ") : "none";
        const stockpile = formatResources(player.resources, ", ");

        return [
            `${player.name}: ${player.might} might, ${player.fame} fame, ` +
            `${player.dragonImpressions}/${GameSettings.DRAGON_IMPRESSIONS_TO_WIN} dragon impressions, ${knightCount} knight(s)`,
            `You hold: ${stockpile === "None" ? "nothing" : stockpile}`,
            `Buildings: ${buildings}`,
        ].join("\n");
    }

    /**
     * The harvest phase as an ordered list of steps, with the cost of each option.
     *
     * Deliberately states no affordability verdicts. Because the market converts between
     * resource types, "can I afford this after harvesting and selling?" is a partition problem
     * over choices the model has not made yet, so any verdict we precompute is either wrong or
     * expensive to get right - and a wrong "you cannot afford this" is worse than none at all,
     * since the model defers to it instead of doing the arithmetic itself. We supply the facts
     * it cannot derive (eligible tiles, active fate effects, which build options are still open)
     * and leave the arithmetic to the model.
     */
    private buildHarvestPhaseSteps(gameState: GameState, player: Player, savedDiceValues: number[]): string {
        const steps: string[] = [];

        steps.push(this.buildHarvestStep(gameState, player, savedDiceValues));

        if (player.buildings.includes("market")) {
            const boosted = gameState.fateEffects.marketRate1to1;
            const rate = boosted ? 1 : GameSettings.MARKET_EXCHANGE_RATE;
            const rateNote = boosted ? " (improved from 2:1 this round by Trade Boom)" : "";
            steps.push(`Market - sell any resources ${rate}:1 for gold, pooled across resource types${rateNote}.`);
        }

        if (player.buildings.includes("blacksmith")) {
            steps.push(`Blacksmith - pay ${formatCost(GameSettings.BLACKSMITH_USAGE_COST)} to gain 1 might. Once per harvest phase.`);
        }

        if (player.buildings.includes("fletcher")) {
            steps.push(`Fletcher - pay ${formatCost(GameSettings.FLETCHER_USAGE_COST)} to gain 1 might. Once per harvest phase.`);
        }

        steps.push(this.buildBuildActionStep(gameState, player));

        return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
    }

    private buildHarvestStep(gameState: GameState, player: Player, savedDiceValues: number[]): string {
        if (savedDiceValues.length === 0) {
            return "Harvest - you saved no dice for harvesting, so you cannot harvest this round. Leave harvestTiles empty.";
        }

        if (gameState.fateEffects.harvestBlockedForAll) {
            return "Harvest - blocked for everyone this round by Famine, so harvesting would yield nothing. Leave harvestTiles empty.";
        }

        if (gameState.fateEffects.harvestBlockedForPlayer === player.name) {
            return "Harvest - you are banned from harvesting this round (Harvest Ban), so harvesting would yield nothing. Leave harvestTiles empty.";
        }

        const diceSum = savedDiceValues.reduce((sum, value) => sum + value, 0);
        const diceString = savedDiceValues.map(die => `[${die}]`).join("+");
        const eligibleTiles = getEligibleHarvestTiles(gameState, player.name);

        if (eligibleTiles.length === 0) {
            return `Harvest - you saved dice ${diceString}, but there are no tiles you can currently harvest from. Leave harvestTiles empty.`;
        }

        // Bountiful Harvest doubles all yields, so show the doubled numbers rather than
        // making the model apply the multiplier itself.
        const multiplier = gameState.fateEffects.doubleHarvest ? 2 : 1;
        const doubledNote = multiplier > 1 ? " Yields below are already doubled by Bountiful Harvest." : "";

        const tileLines = eligibleTiles.map(tile => {
            const yields = Object.entries(tile.resources || {})
                .filter(([, amount]) => (amount || 0) > 0)
                .map(([resource, amount]) => `${(amount || 0) * multiplier} ${resource}`)
                .join(" + ");
            const starred = tile.isStarred ? " (starred)" : "";
            const blockading = tile.claimedBy !== player.name ? ` (${tile.claimedBy}'s tile, which you are blockading)` : "";
            return `   - ${formatPosition(tile.position)}${starred}: ${yields}${blockading}`;
        });

        const cap = Math.min(diceSum, eligibleTiles.length);
        const capText = cap >= eligibleTiles.length
            ? `you can harvest all ${eligibleTiles.length} of your eligible tiles`
            : `you can harvest ${cap} of these ${eligibleTiles.length} eligible tiles`;

        return [
            `Harvest - you saved dice ${diceString} (total value ${diceSum}), so ${capText}, taking every resource from each.${doubledNote}`,
            ...tileLines,
            `   Set harvestTiles to the positions you choose.`,
        ].join("\n");
    }

    /**
     * The build options that are structurally open to the player: not already built, not at a
     * unit cap, prerequisites met. Affordability is deliberately not filtered here - that is
     * arithmetic the model does itself, once it knows what its harvest and market sale yielded.
     */
    private buildBuildActionStep(gameState: GameState, player: Player): string {
        const options: string[] = [];
        const cost = (baseCost: Record<ResourceType, number>) =>
            formatCost(getEffectiveBuildCost(baseCost, gameState));

        if (!player.buildings.includes("blacksmith")) {
            options.push(`blacksmith (${cost(GameSettings.BLACKSMITH_COST)})`);
        }

        if (!player.buildings.includes("market")) {
            options.push(`market (${cost(GameSettings.MARKET_COST)})`);
        }

        if (!player.buildings.includes("fletcher")) {
            options.push(`fletcher (${cost(GameSettings.FLETCHER_COST)})`);
        }

        const hasChapel = player.buildings.includes("chapel");
        const hasMonastery = player.buildings.includes("monastery");
        if (!hasChapel && !hasMonastery) {
            options.push(`chapel (${cost(GameSettings.CHAPEL_COST)})`);
        }
        if (hasChapel && !hasMonastery) {
            options.push(`upgradeChapelToMonastery (${cost(GameSettings.MONASTERY_COST)})`);
        }

        if (player.champions.length < GameSettings.MAX_CHAMPIONS_PER_PLAYER) {
            options.push(`recruitChampion (${cost(GameSettings.CHAMPION_COST)})`);
        }

        if (player.boats.length < GameSettings.MAX_BOATS_PER_PLAYER) {
            options.push(`buildBoat (${cost(GameSettings.BOAT_COST)})`);
        }

        if (!player.buildings.includes("warshipUpgrade")) {
            options.push(`warshipUpgrade (${cost(GameSettings.WARSHIP_UPGRADE_COST)})`);
        }

        const discountNote = gameState.fateEffects.buildCostReduction
            ? " Costs below are already reduced by Merchant Fair." : "";

        if (options.length === 0) {
            return "One build action, paid last - but you have already built everything available to you, so omit buildAction.";
        }

        return `One build action, paid last (so you cannot use a building you build this round).${discountNote}\n` +
            `   Still open to you: ${options.join(", ")}.\n` +
            `   Omit buildAction if you would rather save the resources.`;
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
