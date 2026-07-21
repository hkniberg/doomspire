# Playtest Analysis — The Four Claudes (2026-07-19)

A design review of the 18-round, 4-player AI match (Haiku, Sonnet, Opus, Fable). Companion to `game-summary.md`, which tells the story. The goal here is to *point out* design questions the match surfaced, not to solve them — where a fix is obvious it's named, otherwise options are listed for discussion.

**Important caveat up front:** this is an AI playtest standing in for a human one. The simulator deliberately disables trading and negotiation, the AI players compute exact win probabilities and turn-order math that humans won't, and several observed behaviors (chronic food-tax failures, never parking at special tiles) look like AI-strategy artifacts rather than design signals — these are collected in `simulator-issues.md` rather than treated as design flaws. Findings about *mechanics* (what got used, what won, what never came up) are the most reliable evidence; findings about *feel* need human confirmation.

---

## 1. The questions this doc tries to answer

- Did the game produce tension and a satisfying arc, or dead stretches?
- Are the win conditions balanced, or is one dominant / one dead?
- Which mechanics earned their complexity? Which never got touched (and is that design or AI behavior)?
- Any degenerate or dominant strategies?
- How swingy is it — did dice and card draws decide too much?
- Did every player have meaningful decisions until the end?
- Would this have been fun and manageable *at a physical table*?

---

## 2. Win condition scorecard

Four dragon impressions happened in the game. How each path performed:

| Path | Uses | Verdict |
| --- | --- | --- |
| **Gold (12+)** | 3 impressions (Fable ×1, Opus ×2 — the win) | Strongest showing, and it *does* have counterplay (see §4.1) — Fable was knocked below the threshold once by looting. Worth watching, not obviously broken. |
| **Starred tiles (4+)** | 1 impression (Sonnet) | Viable and dramatic — fragile in a way that generated the game's best conflict (§3.1). |
| **Fame (17+)** | 0 — max fame all game was Sonnet's 10 | Never in reach this match. Partly AI behavior (chapel/monastery never built, few adventure pushes late), but the gap to 17 was large. See §4.3. |
| **Defeat the dragon** | 0 attempts won; dragon went **4–0**, eating four knights | No player ever assembled odds worth taking. See §4.2. |
| **Treasures (Dragon's Egg)** | Found by Opus, never spent | Huge strategic weight even unused — it functioned as insurance that made Opus's endgame gambit safe. One card nearly decided the game (§5). |

Fame and combat contributed zero impressions and zero credible threats this match. Whether that's a balance problem or an artifact of one AI game is a key thing to check in a human playtest.

---

## 3. What worked well

### 3.1 Doomspire camping-at-risk is the star mechanic — but its timing rule must be decided

"A knight can stay at Doomspire, but needs to impress the dragon each round or be eaten" single-handedly created the endgame. Camping turned a static win condition into a standing target: rivals had a burning incentive to break the camper's impress condition (Fable conquering/bribing Sonnet's starred tiles), to attack knights to loot gold, and to race for position. Three of Sonnet's knights died to this dynamic. This tension is exactly what the design wants — keep the camping mechanic.

**⚠ Design question (to confirm with codesigner — the rules as written didn't answer it, and the simulator picked one interpretation):**

> **When a knight is staying at Doomspire, at what moment does the impress-or-be-eaten check happen — and can the owner act first?**

The original rulebook line ("A knight can stay at Doomspire, but needs to impress the dragon each round or be eaten") gave no timing. The main options:

1. **Start of the owner's turn, automatic, no escape** — what the simulator did. Harshest: a condition broken by rivals since your last turn kills the knight before you can respond. Also makes turn order decisive in the endgame (Opus won on token math, §4.5).
2. **End of the owner's turn in the movement phase** — the owner may evacuate or repair the condition first; if the knight stays, the check fires as their turn ends. Simplest to learn and run: a self-contained end-of-turn trigger, no global cleanup step. Trade-offs: a *qualified* camper still wins before later-in-turn-order players can act (turn order keeps its endgame weight, §4.5), and the dragon rarely actually eats anyone, since an owner whose condition broke can always just walk away.
3. **End of the movement phase** (after all players have moved) — a global cleanup check. Every challenger gets their move before a camper's winning check fires, so token position stops deciding photo-finishes; and rivals moving after the owner can still spring the eaten-trap. Costs one extra step the table must remember after the last player moves.
4. **Only when the knight enters or interacts** (the most literal reading of "When you enter or interact with the doomspire tile, you attempt to impress") — but this permits free squatting/blocking without ever attempting, which the "each round" line clearly exists to prevent, so it would need a separate anti-squat rule.

**Interim decision (2026-07-21): option 2**, chosen as the simplest to explain, learn, and remember. `docs/game-rules.md` and the cheat sheet have been updated; updating the simulator is a TODO in `simulator-issues.md`. Options 1–4 all remain on the table for the codesigner discussion — in particular weigh option 2's simplicity against option 3's turn-order neutrality and sprung-trap drama. Note that in this match, all three of Sonnet's dragon-eaten knights died specifically under interpretation 1; under interpretations 2–3 she likely evacuates them and the game plays out very differently.

### 3.2 Takeover costs are in the sweet spot

2 fame / 2 gold to conquer or bribe an unprotected tile looked almost too cheap — but it's exactly why the endgame worked. Sonnet's counterpunch (kill the offending knight, loot 5 resources, bribe the tile back) showed the interaction is two-way. The protection rule (adjacent knight) also mattered constantly: players routinely spent movement to protect and reasoned about which tiles were exposed. This whole subsystem earned its complexity.

### 3.3 PVP looting hits the stockpile — and that matters

Because looting steals from the *player's* stockpile (half their tile count, rounded up, winner picks), beating any of a rival's knights in the field strikes at their banked gold. Sonnet's round-12 win over Fable's knight took 4 gold and dropped him from 13 to 9 — below the 12-gold threshold — and Opus's round-17 defense took 5 more. This is the intended counterplay against gold hoarders, and it demonstrably worked.

### 3.4 Support — including supporting the dragon

Opus supported the dragon twice, both times helping eat a rival's knight at zero cost to himself. Mechanically it barely mattered (the dragon was winning anyway), but it's a delicious diplomatic lever — and at a human table, with the announce-after-the-roll rule, this is where the betrayal drama lives. The AI proxy understates this whole axis: no table talk means no promises to break.

### 3.5 Flee

Fleeing was used often and well (Sonnet fled a bear at (2,3), Fable's knight fled Sonnet's Doomspire assault cleanly). The 1D3 flee table gives real decisions without bookkeeping. No changes suggested.

### 3.6 The fate deck as pacing engine

Festival (all knights to the Trader) accidentally armed two players with Spears and enabled a knight recruit. Bountiful Harvest enabled Fable's 13-gold turn. Dragon's Shadow, Dragon Off Hunting, and Famine all bent the endgame. The deck kept rounds from feeling identical — the main concern is variance, covered in §6.

---

## 4. Balance observations and discussion points

### 4.1 The gold path was the strongest line this match — watch it, with counterplay in mind

Three of four impressions came from 12+ gold, and both finalists used the same engine: **market (2 food + 2 wood, the cheapest building) + selling surplus 2:1 + gold being a threshold rather than a payment.** One big conversion turn (Fable: 5 → 13 gold under Bountiful Harvest) banks the condition, and the same hoard pays for *both* impressions.

Counterplay does exist and was used: defeat any of the hoarder's knights in PVP and loot gold straight from their stockpile (§3.3) — this broke Fable's threshold once. The limitation is that it requires catching a knight outside a home tile; a hoarder can turtle until the Doomspire run itself. Discussion points rather than a verdict:

- Is threshold-not-payment intended? A tribute cost (spend some gold to impress) would make the second impression a fresh climb, mirroring how starred tiles must be *held*.
- Is unlimited 2:1 market volume right? A per-harvest cap would slow one-turn banking.
- Or accept it: the market/hoard/loot triangle produced good play this match, and human negotiation (gang-ups) will pressure hoarders more than AIs did.

### 4.2 The dragon is unbeatable in practice

Four combat deaths, zero wins, and every AI correctly treated dragon combat as suicide (Fable computed ~1–2% before his final gambit). Might 8 + 2D3 vs. the ~5–7 might players realistically assemble means every non-qualifying Doomspire visit was an execution. The question to settle: is "Combat" a real fourth path or a thematic deterrent? If a real path, it needs reachable math (easier support at the mountain, dragon-specific items, or flat might 8). If a deterrent, fine — but the rulebook's framing ("defeat the dragon in battle") reads like an option, and the box-back promise of a combat path went unused.

### 4.3 Fame 17 was out of reach — how much of that is AI behavior?

Nobody passed 10 fame in 18 rounds. But note what didn't happen: chapel/monastery (+3/+5 fame) were never built, and adventure-tile pushes dropped off once players were mid-engine. Human players may pump fame harder. Countervailing observation: fame has many *sinks and competitors* — conquest costs 2 fame, the temple converts fame to might, and votes drain nothing but make fame a target. Worth one human playtest before touching the threshold; if it still never gets within range, lower it or raise exploration/kill payouts.

### 4.4 The Spear is very strong for 1 gold

Permanent +1 vs. beasts converts every wolf (might 2) into a guaranteed win, and with fletcher-fed might 3, every bear (might 5) too. Both buyers turned it into a fame-and-starred-tile engine, and at 1 gold it's an auto-buy on any trader visit. Options:

- Raise the price (2–3 gold).
- Change the effect from flat +1 to **a reroll when fighting a beast** (equivalently: roll 2D3, keep the best). This keeps it exciting and beast-flavored but preserves risk — a wolf fight at 0 might goes from 67% to ~89% instead of 100%, and it can't stack into certainty with might.

### 4.5 Turn order decided the winner — downstream of the §3.1 question

Opus won specifically because the first-player token put his move before Fable's in rounds 17–18, and the simulator fires the parked-knight impress check at the start of the owner's turn. Both AIs computed this explicitly and it was the decisive resource of the endgame. How much turn order should matter at Doomspire is really the same decision as the check-timing question in §3.1. Note that the interim rule (check at end of the owner's turn) does **not** remove this: a qualified camper still banks the winning impression before later-in-order players get to act, so this match's token-decided finish would replay the same way. Option 3 in §3.1 (end of movement phase) is the variant that neutralizes turn order — a key trade-off for the codesigner discussion.

### 4.6 Dice tax: working as intended, but the AIs couldn't handle it

Players lost roll dice to the 2-food tax roughly 19 times across 18 rounds. This is *not* flagged as a design problem: the tax is an intentional brake on multi-knight action economy, and human players reportedly plan around it routinely. The AIs repeatedly sold or spent themselves to zero food despite writing "keep 2 food for dice tax" in their own plans — that's an AI-planning/prompting issue, logged in `simulator-issues.md`. Keep half an eye on it in human playtests, but no rule change suggested.

---

## 5. Mechanics audit: unused, underused, overworked

Verified against the full log. **Caution:** for the special-tile rows, human play reportedly differs a lot from what the AIs did — players commonly park a knight at the mercenary camp (or temple) and convert every round. Zero usage here is probably an AI-strategy artifact (see `simulator-issues.md` re prompt awareness), not proof the tiles are dead.

| Mechanic | Usage in 18 rounds | Notes |
| --- | --- | --- |
| **Temple** (2 fame → 1 might) | Never used | Likely AI artifact (see above). Also, fame was scarce this match, so the conversion price was steep. |
| **Mercenary camp** (3 gold → 1 might) | Never used | Likely AI artifact — though note this match's meta (hoard gold for the threshold) actively punishes spending gold on might. |
| **Chapel / Monastery** | Never built | 6–8 wood is a big ask when wood also feeds the fletcher and market, and +3/+5 fame chased a threshold nobody was near. The main fame lever in the game went untouched — relevant to §4.3. |
| **Warship upgrade** | Built once (Haiku, round 6); never triggered | No coastal battle involving her boats ever happened. Cost her tempo at a critical moment. |
| **Second boat** | Never bought by anyone | One boat was always enough; transport was used well but sparingly. |
| **Item drop/pickup** | Never voluntarily used | Items only moved via looting. Fine, but the drop rules may be more text than the game needs. |
| **Blockade** | Used once (Haiku on Fable's (3,0), round 14) | Marginal impact — the takeover options are strictly more decisive for 2 gold/fame. May matter more between humans as a threat/negotiation tool. |
| **Followers** | Witch's +2 won *one* pivotal fight (the round-8 bear); Brawler joined and was never used before being eaten | Follower loss-on-death is brutal and reduced follower value to near zero for Doomspire-bound knights. |
| **Trader items** | Spear ×2 purchased; nothing else ever bought | The open trader deck saw essentially one SKU move. Worth reviewing prices/effects of the rest of the deck. |
| **Adventure tiers** | Tier 1/2 heavily used; **tier 3 drawn once** (Dragon Raid) | The mountains' high-risk content went almost entirely unseen — (3,4), (4,4), (4,2), (3,5), (5,5) were still face-down at game end. The center was a place to *avoid* except for the Doomspire sprint. |

---

## 6. Swinginess

- **1D3 monster combat is harsh at low might.** Three players lost repeated 67% wolf fights on rolls of 1 (Fable lost four straight early combats). The individual downside is cheap by design, which is good — but the *tempo* loss compounded: those failures are much of why Fable spent the midgame in last place. Humans on a losing streak like that get salty. The Spear-as-reroll idea (§4.4) generalizes: a limited reroll mechanism somewhere in the system would trim the worst feel-bad without removing risk.
- **Dragon Raid (one tier-3 card) confiscated 8 tiles**, including the leader's entire win condition. It self-corrected within a round (tiles were reclaimable) and made for a great story beat, but as a single blind draw it's the swingiest thing in the game by an order of magnitude. Options: cap losses (max 2 tiles?), or target starred tiles only.
- **Fortune Smiles misfired as catch-up:** it grants 3 resources to the player with the *fewest* resources — which in round 11 was Sonnet, the runaway leader, because she'd converted everything into board position. Stockpile is a bad proxy for who's behind. Fewest *tiles* or fewest *impressions+fame* would target better.
- **Council votes fizzled early, hit hard late.** The first two votes died to the all-zero-fame tie rule. From round 5 on, fame-weighted voting consistently punished the leader (Penalty→Opus, Banishment→Haiku, Disarmament→Sonnet), acting as a decent soft catch-up. Note the leader's own vote is huge (Sonnet's 9 fame redirected Banishment onto Haiku single-handedly) — that's interesting, but it means the #2 player often eats the hit instead of #1.

---

## 7. Engagement arc and dead time

Fun curve, inferred from the decision content of each round:

- **Rounds 1–7: functional but samey.** Parallel engine-building with almost no interaction (by design — Settling/Ceasefire cover rounds 1–2). Every turn was claim-harvest-build. Fine for learning; a human table would be chatting through it, but 7 rounds of solitaire before contact is long. The first genuinely interactive act was round 8 (Haiku's denial bear-kill).
- **Rounds 8–15: excellent.** Race dynamics, denial plays, the bribery war, three dragon meals, and lead changes every other round. If a human game hits this stretch, the design is doing its job.
- **Rounds 16–18: great for two players, dead for two.** **Haiku correctly wrote "the game is mathematically decided" in round 13** and spent six rounds optimizing consolation titles; **Sonnet had zero knights from round 15**, reduced to one castle die and pure bookkeeping turns. AI players dutifully grind those turns; humans check their phones. The consolation titles genuinely helped (the Master of Coin race between Opus and Haiku was real), but the knightless state is close to elimination-in-place. Discussion points: a cheaper re-recruit for knightless players, or some minimal action for the castle die beyond harvesting.
- **Game length: 18 rounds** felt right for the content but is probably 2.5–4 hours physical.

---

## 8. Physical-table considerations

Things the simulator absorbs silently that a human table must do by hand:

- **The fate phase is a lot of upkeep.** Every round: draw, read, possibly vote with fame weights (requires everyone reading the fame track), then apply effects like "move every boat clockwise" or "all knights to the Trader." Dragon Raid required each player to roll and pick tiles to remove. It's all doable but the fate deck is the game's biggest rules-throughput moment — worth watching in a human test for how much it stalls.
- **Dice tax and harvest math** were error-free here because software; humans will occasionally roll untaxed dice or harvest a blockaded tile. The two-step harvest (save dice, then resolve) is clean.
- **The Doomspire check timing (§3.1)** is self-enforcing on a board only once the rule says exactly when it fires — sharp human players will lawyer this, and the game can hinge on it (it did here).
- **What this playtest could not test at all:** trading, negotiated support, promises and betrayal, and vote collusion. These are the systems most likely to change the balance picture — e.g., the gold path is weaker if rivals can coordinate interceptions, and votes play very differently with open deal-making. Do not tune those systems from this data.

---

## 9. Summary of issues raised

For discussion, roughly in order of importance:

1. **Confirm the Doomspire impress-check timing** (§3.1) — interim decision taken (option 2: check at the end of the owner's movement turn; rules and cheat sheet updated, simulator update pending). The main open trade-off is simplicity (option 2) vs. turn-order neutrality (option 3, §4.5). Revisit in the codesigner discussion.
2. **Dragon combat: path or deterrent?** (§4.2) — 4–0 to the dragon; decide the intent and either fix the math or reframe.
3. **Gold path strength** (§4.1) — counterplay exists and worked once; discuss threshold-vs-tribute and market volume before deciding anything.
4. **Fame threshold** (§4.3) — never in reach this match, but confounded by AI behavior; check in a human game first.
5. **Spear** (§4.4) — obvious candidate fixes: price up, or reroll-vs-beasts instead of flat +1.
6. **Knightless endgame state** (§7) — near-elimination for a human player; worth softening.
7. **Dragon Raid magnitude / Fortune Smiles targeting** (§6) — two fate cards worth a second look.
8. **Trader deck beyond the Spear, follower fragility, warship/second-boat value** (§5) — low priority; gather more data.
9. Keep unchanged: camping-at-risk itself, the takeover/protection economy, stockpile looting, flee, support-the-dragon, the two-step harvest.

Simulator/AI problems observed during this match (action failures, food-tax planning, unresolved combat state, prompt gaps) are deliberately excluded from the list above — see **`simulator-issues.md`** in this folder.

## 10. Confidence caveats

Single game, so every quantitative claim rides on one deck order and one set of dice. The early wolf-loss streak, the Dragon Raid, and the Dragon's Egg find were all individually game-shaping. The most reliable findings are structural: the impress-check timing gap, the dragon's 4–0 record, the gold/market engine, and the unused-content list. The feel/pacing observations — and everything the AI proxy distorts (special-tile parking, food planning, negotiation) — need a human table, which is the point of the next playtest.
