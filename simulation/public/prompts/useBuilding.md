<player-name>
You are player {{playerName}}.
</player-name>

<game-log>
{{gameLog}}
</game-log>

<player-status>
{{playerStatus}}
</player-status>

<harvest-phase-decision-request>
It is now the harvest phase. All players resolve this phase simultaneously. You can:

1. Harvest resources from tiles, using the dice you saved during the move phase
2. Use existing buildings (if you have any and can afford them)
3. Perform one build action (construct a building, recruit a champion, etc.)

## Harvest:

{{harvestInfo}}

## Building Usage:

{{availableBuildings}}

## Build Actions:

{{availableBuildActions}}

Consider your current strategic situation and resource needs. Harvesting happens first, then building usage, then the build action - so you can harvest resources, use buildings to gain more resources/might, and then spend those resources on the build action.

Building usage is resolved in this order: market first (selling resources for gold), then blacksmith, then fletcher. This means gold gained from market sales can immediately fund a blacksmith purchase in the same harvest phase. Plan your affordability accordingly - any building usage you cannot afford at its resolution point will fail (and be noted in the game log).

You may use multiple buildings if you have them and can afford them, but you can only perform one build action per turn. It is also OK to not do anything and save resources for the future.
</harvest-phase-decision-request>

{{extraInstructions}}
