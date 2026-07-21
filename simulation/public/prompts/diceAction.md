<player-name>
You are player {{playerName}}.
</player-name>

<current-board-state>
{{boardState}}
</current-board-state>

<game-log>
{{gameLog}}
</game-log>

<turn-context>
It is currently turn {{turnNumber}} and it is your turn as {{playerName}}. Your remaining dice values are: {{remainingDice}}.
</turn-context>

<dice-action-request>
Choose an action, and which dice to use for it. Follow your tactical plan from the game log.

Respond with a JSON object specifying your dice action, and which die value you will use for it.

The actionType MUST be one of the following:

1. championAction: Do something with a champion (move and/or act on a tile). You may combine multiple dice into one longer movement (sprinting) by setting diceValuesUsed to an array of dice values - the step values add up.
2. boatAction: Do something with a boat (move and/or transport a champion to a tile, who then can act on that tile)
3. harvestAction: Save one or more dice for the harvest phase. Total die value = number of different tiles you will be able to harvest from. You choose which tiles to harvest from later, during the harvest phase (after all players have moved).

Important restrictions:

- Once a champion has interacted with a tile (explored, fought, drawn an adventure card, used a special location, claimed or taken over a tile), that champion cannot use any more action dice this round. Choose another champion, a boat action, or a harvest action instead.
- Build actions (using buildings, constructing buildings, recruiting champions, etc.) happen automatically during the harvest phase, after all action dice are used.

Make sure your action is legal according to the game rules and the current board state.
</dice-action-request>

{{extraInstructions}}
