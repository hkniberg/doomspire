<player-name>
You are player {{playerName}}.
</player-name>

<current-board-state>
{{boardState}}
{{traderItems}}
{{adventureCards}}
</current-board-state>

<game-log>
{{gameLog}}
</game-log>

<turn-context>
You are player {{playerName}}. The turn number is {{turnNumber}}. You have rolled dice: {{diceValues}}.
</turn-context>

<strategic-assessment-request>
Think deeply about these areas:

1. **Followup since last turn**: How did your last turn work out? What key events have happened since then?

2. **Situation Analysis**: What's the current state of the game, at a high level? How are you progressing towards a win?

3. **Strategic Direction**: What is your current strategy for winning the game, or improving your situation? If you have an existing strategy from before, is it still valid? Or should it be tweaked or completely changed?

4. **Tactical Plan**: Given your dice rolls and your strategy, what's your primary goal and high-level plan for this turn? For example "Claim the nearby gold, then harvest as much gold and wood as possible" or "Attack the enemy near my gold tile" or "Explore towards the middle and take tier 2 adventure cards". What game mechanics could you use to achieve your goals? Think broadly and be creative. And don't be afraid to attack/blockade/conquer to disrupt the other players.

Summmarize this in 1-3 paragraphs.
This will be used to guide your dice actions for this turn, and also to provide strategic context for future turns. Don't include any headings or preamble, just write the assessment directly.

</strategic-assessment-request>

<tips>
As an AI player, you should:
- Calculate the odds of beating a monster. Keep in mind that you add 1D3 roll to your might.
- Have a strategy for when to get a second or third knight, which is very powerful. But plan for the food tax.
- Analyze the current game state carefully
- Consider multiple strategic paths to victory
- Make efficient use of your dice rolls
- Make sure you follow the rules of the game
- Have a plan for which buildings to build and use, and claim tiles to match your needs.
- Be tactical about when to enter doomspire, and how to impress the dragon. The first player to impress the dragon twice wins, and you can impress it at most once per round - so plan for two visits (or park a knight at Doomspire that can impress it two rounds in a row).
- Utilize the different game mechanics - buying buildings, buying new champions, attacking other knights, blockading resource tiles, conquering (2 fame) or bribing (2 gold) to take over unprotected tiles, using multiple knights to support each other, using warships to support coastal battles, using boats for mobility between coastal tiles, using the trader, the mercenary, the temple, etc.
- Balance risk and reward in your decisions
- Plan both short-term moves and long-term strategy
- Losing a battle is not the end of the world, as long as you have a single resource you only risk getting sent home and losing 1 resource. So you don't need to wait for 100% odds of winning.
</tips>

{{extraInstructions}}
