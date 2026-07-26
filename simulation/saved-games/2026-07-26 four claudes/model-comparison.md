# Model Comparison — Sonnet 5 vs Opus 5 vs Fable 5

**Source:** the 2026-07-26 four-player match (14 rounds).
**Seats:** Sam (NW) and Sarah (NE) on **Sonnet 5**, Oliver (SW) on **Opus 5**, Fabian (SE) on **Fable 5**.

## Recommendation up front

**Use a mixed table, with Opus and Fable in two seats and Sonnet in the other two — which is exactly what this match was, and it produced the best playtest data of the three runs so far.**

If you have to pick one model for all four seats:

- **For balance testing a specific mechanic, use Opus.** It finds the optimal line fastest and most reliably, and it is the only model here that made non-obvious *rules-structural* inferences (thresholds vs costs, phase-ordering constraints, free actions). If a mechanic is exploitable, Opus will find and execute the exploit, which is what you want a balance test to surface.
- **For discovering unknown-unknowns, use Fable.** It touched far more of the rulebook than anyone else and invented the single most creative play of the match. It will exercise systems that the other models never even consider.
- **Sonnet is genuinely playable and cheap enough for volume**, but it produces a meaningful rate of rules errors that can masquerade as balance findings. If you run Sonnet-only tables, read the log with more suspicion.

The rest of this document is the evidence.

## Summary scorecard

| | Rules comprehension | Systems breadth | Strategic planning | Tactical execution |
| --- | --- | --- | --- | --- |
| **Opus 5** (Oliver) | Best — several load-bearing inferences | Narrowest, but deliberately so | Best by a clear margin | Flawless after round 5 |
| **Fable 5** (Fabian) | Very good, widest coverage | Widest by far | Good, but reactive | Creative; some avoidable variance |
| **Sonnet 5** (Sam, Sarah) | Good with a recurring blind spot | Narrow, and by omission | Adequate; weak on milestones | Recurring unforced errors |

## Opus 5 — Oliver

**What it did well.** Opus's advantage was not tactics, it was reading the rules as a *system* and finding the structural consequences. Four inferences carried its whole game, and no other model made any of them:

- **"Gold is not spent when impressing"** — it recognised in round 3 that the 12-gold condition is a threshold check, not a payment, which makes gold uniquely safe to hoard as a win condition. It stated this before it had a single gold piece.
- **The park-at-Doomspire re-impression check requires no action die.** It planned the two-impression win around this eight rounds before executing it.
- **Harvest resolves after movement**, therefore it is impossible to cross 12 gold and enter a mountain tile in the same round. This is a subtle turn-structure constraint, and Opus used it to correctly schedule round 12 as a staging round and round 13 as the strike. It got the timing exactly right.
- **Loot scales with tiles owned**, so its 9-tile economy made a PvP loss unusually expensive (5 resources) — which it cited as the reason to keep its knights paired and its gold buffered above the threshold rather than exactly at it.

Beyond rules, its planning horizon was in a different class. It wrote explicit milestone schedules ("Fletcher R7, might 1–2 by R9, first bear R9–10, Doomspire run R12–13") and then actually hit them, adjusting the schedule when reality moved. Its round-11 pivot from the 4-starred-tile route to the 12-gold route was correctly reasoned from a board fact — the remaining starred tiles were all behind bears in enemy territory — rather than from mood. And it adopted explicit standing rules after being burned, most notably "never end a harvest with fewer than 2–3 food" after losing a die to the dice tax in round 5, and "never enter an unexplored mountain tile below 12 gold."

It also made the most subtle *economic* observation of the match, which nobody else came close to: once its dice pips already covered most of its tiles, additional 1-resource flatland claims were worth almost nothing, so it stopped claiming and switched to converting. Every other player kept grabbing marginal tiles well past the point of usefulness.

**Weaknesses.** It over-extended in round 4, recruiting a second knight down to 1 food and losing a die two rounds running — identified and fixed. It sat at 0 fame for eight rounds, which cost it all vote weight (it abstained from two council votes and explicitly noted the cost). That turned out to be an enormous advantage, since it made Opus politically invisible while the table hunted Sam and Fabian, but Opus did not plan it that way — it treated low fame purely as a cost. Credit for the win belongs to the plan; the political immunity was luck.

**Style note for cost purposes:** Opus wrote by far the longest reasoning, consistently structured under bolded headers every single turn. Its per-turn token usage is noticeably higher than the others, which compounds with its per-token price.

## Fable 5 — Fabian

**What it did well.** Fable used more of the rulebook than the other three models combined. It was the only player to use the **temple** (ferrying a knight to (0,4) to trade 2 fame for 1 might, and noting the temple doubles as a safe non-combat parking spot), the only one to reach **three knights**, the only one to use **conquest** as an alternative to fighting (twice), and it accounted for **three of the four boat actions in the entire game**.

Its round-5 turn is the best single play of the match and the kind of thing you run playtests to find: it moved its boat to pick up a knight from home and dropped it directly onto a wolf-guarded starred tile where its *other* knight was already standing adjacent — turning a 67% fight into a guaranteed win — then immediately used the newly-delivered knight's diagonal adjacency to make a second wolf kill guaranteed as well. Two risk-free kills, one claimed starred tile, out of a turn that contained no favourable dice.

Its threat modelling was also the best at the table. After the unanimous Disarmament vote in round 10 it correctly inferred "the table sees me as a threat" and changed its approach to rebuilding might through steady income rather than one vulnerable push. It spotted that Sam's tiles were unprotected by checking knight adjacency, not just ownership. And its round-13 endgame read was the most rigorous piece of analysis anyone produced: it enumerated every route to Doomspire, computed the alternative attack at roughly 7%, correctly concluded the game was unwinnable, and pivoted cleanly to maximising final ranking — which won it Hand of the King.

**Weaknesses.** It kept taking 67% wolf fights at 0 might and went 0-for-4 on them, including one in round 10 after it had already noted the losing streak. Those are EV-positive gambles, so this is defensible, but the variance repeatedly cost it tempo it could not afford. More importantly, it never set its own clock: it had good plans for *this turn* and good reactions to the leader, but no dated schedule for reaching a win condition. It finished with 10 tiles, 3 of the 4 starred tiles it needed, and 0 gold — broad, active, and pointed at nothing in particular.

## Sonnet 5 — Sam and Sarah

Two seats gives a better read than one, and the two Sonnet players had noticeably different games, which is itself useful information: the variance within Sonnet was larger than the gap between Sonnet's better seat and Fable.

**Rules comprehension — one real, repeated blind spot.** Sarah twice moved a knight onto an already-explored adventure tile believing it was inert, writing in her stated reason that "already explored... so no adventure draw triggers." Both times she drew a card, and both times it wrecked the multi-die support plan she had built the turn around — the second one (round 10, a Thug Ambush that stole her gold) cost her the bear fight she was setting up. To her credit she corrected it by round 11, explicitly routing around "an unresolved adventure tile." Sam, meanwhile, understood the rule correctly and deliberately avoided an untouched oasis for exactly this reason. So this is a Sonnet-level inconsistency rather than a flat gap.

Sarah also evaluated her round-12 attack on might alone and ignored that the defender had a knight adjacent for +2 support. She lost 9–7, which is precisely the margin that support accounted for. Her reasoning on that turn also contains an incoherent sentence about the odds ("my minimum roll of 5 beats his maximum of 6 only occasionally"), suggesting the arithmetic was not actually being done.

Sam's rules understanding was better than Sarah's in places — he correctly worked out that monster combat never costs items (so the egg was safe from everything except PvP), and his round-13 retreat into the trader tile to hide the egg in a non-combat zone was a genuinely good rules-exploiting defensive play. But his round-10 stated reason contains a visible self-interruption mid-thought ("...wait, actually egg is on champion1, but loss only costs a resource, not the egg itself, so still fine"), which is unpolished reasoning leaking straight into the action log.

**Strategy — the real weakness.** Sam held the single most valuable asset in the game from the first move and never built a plan around it. For ten consecutive rounds his reasoning restated the same three things — I have the egg, my second-impression path is thin, I should keep probing forward — without ever converting that into a schedule or a concrete purchase. He never bought a point of might in 14 rounds, ending at 0. He never protected his tiles and lost both starred tiles in consecutive rounds to conquest while his knights sat idle. He identified the problem correctly and repeatedly, and never acted on it.

Sarah was the better strategist of the two: her multi-die support sequencing was sophisticated, her round-11 decision to fire the Blacksmith and Fletcher in the same harvest (using resources that would otherwise sit idle) was sharp, and she built the only complete Market/Fletcher/Blacksmith engine at the table. But she never found anything to spend it on, and by round 13 correctly noted her chosen win route was already closed.

**Neither Sonnet seat ever used a boat.** In 14 rounds, across two players, the boat was used zero times except when a fate card pushed it. That is a significant chunk of the game's mobility system left completely untouched.

## Important caveats

- **This is one game.** One Opus seat, one Fable seat, two Sonnet seats, with different board positions and wildly different dice.
- **Board position is a real confound and it favoured Opus.** Oliver's southwest quadrant was monster-free and resource-rich — he said so himself in round 1. The other three all had wolf-guarded tiles adjacent to home and all lost those fights. So "Opus never lost a combat" partly reflects a corner that never forced one. That said, Opus also *declined* optional 67% fights and optional explorations that the others took, so temperament is doing some of the work too.
- **The dice were unusually cruel to the aggressive players.** The table went 2-for-9 on 67% wolf fights. Fable and Sonnet both took those fights; Opus did not. A normal dice run would have narrowed the visible gap considerably without changing the quality of the underlying decisions.
- **Outcome is a weak signal here; process is the stronger one.** My ranking above is based on the stated reasoning quality, not on who won.

## Practical guidance by playtest goal

- **Testing whether a specific rule is exploitable → Opus.** It found the game's most severe exploit (12-gold threshold plus the free park-at-Doomspire re-impression) and executed it with zero counterplay available to the table. That is a balance finding you would probably not have got from a Sonnet-only table.
- **Testing whether the rules are *discoverable* and whether the game's systems get used → Fable.** It is the only model that reliably exercises boats, the temple, conquest and bribery, and multi-knight positioning. Note that four players across 14 rounds produced zero chapels, zero monasteries, zero warships, zero second boats, zero mercenary camp visits, and exactly one trader purchase — and Fable was responsible for a disproportionate share of everything that *did* get used.
- **High-volume iteration and regression runs → Sonnet.** It plays a coherent, rules-respecting game at a fraction of the cost. Budget for a few rules errors per match and do not treat a surprising outcome from a Sonnet table as a balance signal without checking the log first.
- **Best single configuration:** keep mixing. The mixed table gave you a strong optimiser, a creative explorer, and two competent-but-fallible players who generate the messy situations that make a playtest interesting. It is also the closest thing to a real mixed-skill human table.
