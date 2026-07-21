<player-name>
You are player {{playerName}}.
</player-name>

<current-situation>
You need to make a decision.

{{description}}

Available options:
{{options}}
</current-situation>

<current-board-state>
{{boardState}}
</current-board-state>

<game-log>
{{gameLog}}
</game-log>

Respond with a JSON object containing your choice and reasoning. Your choice must be the exact id (the quoted string) of one of the available options listed above.
