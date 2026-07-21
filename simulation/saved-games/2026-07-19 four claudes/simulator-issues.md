# Simulator Issues — observed in the Four Claudes match (2026-07-19)

Things to investigate in the simulator and AI prompts, separated from the game-design findings in `playtest-analysis.md`. Nothing here has been fixed yet — this is a checklist for later.

## 1. Action failures consumed dice / overload error handling

- **Round 14, Sonnet:** two consecutive Anthropic API `overloaded_error` responses during her attack on Fable's knight at (2,5). Both failures **consumed her dice**, so the attack she had planned (and narrated) never resolved.
- Proposed handling: the Anthropic SDK likely already does automatic retries, so by the time we see `overloaded_error` it may be reasonable to treat it as unrecoverable for that prompt. But we need a **fallback (e.g., a random legal action)** so a failed prompt doesn't stall or corrupt the match — and ideally infra failures shouldn't burn the player's dice at all.
- **Round 12, Haiku:** `Dice action failed: Champion 1 not found for player Haiku` — she tried to command champion1, which had been eaten by the dragon in round 11. The die was consumed. Two possible fixes: present dead champions more clearly in the prompt/game state, and/or reject-and-retry invalid actions instead of consuming the die.
- **Round 13, Haiku:** `Dice action failed: Dice value 2 not found in remaining dice []` — the AI planned two actions but the first consumed all dice; the second failed against an empty pool. Suggests the AI's view of remaining dice can go stale mid-turn, or the prompt should re-state remaining dice between actions.
- **Round 15, Haiku:** `Champion 2 has already interacted with a tile and cannot use more action dice this round` — similar category: the AI issued an illegal follow-up action.

## 2. Unresolved combat state after failed actions (engine bug)

Fallout from issue 1: at the end of round 14, Sonnet's champion1 and Fable's champion2 were **co-located on (2,5) with combat never resolved**. Fable's round-14 reasoning explicitly called it out: "a simulator glitch left them co-located without combat resolving." Enemy knights sharing a non-special tile should be impossible. Needs a state-validation pass, or combat resolution triggered on co-location regardless of how it arose.

## 3. Duplicate champion IDs (state bug — possibly already fixed)

An AI player (Haiku) lost champion1 while already having a champion2; the newly recruited champion was **also named champion2**. The final `gamestate.txt` still lists Haiku with two `champion2` entries (at (0,3) and at (0,0)). This may already be fixed (a prompt about it was written during the match) — verify, and check whether it's display-only or the engine actually collides IDs. Issue 1's "Champion 1 not found" failure may be related.

## 4. Fate card votes — rules and implementation questions

- **Do 0-fame players need to vote at all?** Their vote weight is 0, so it can never affect the outcome. Rules don't exempt them; simulator could skip prompting them to save tokens/time (but log a weight-0 abstention for flavor?).
- **Are AI votes collected simultaneously/independently?** They should be — the simulator notes say votes are one-shot decisions with no discussion. Verify that later voters are not shown earlier players' votes.
- **Do voters get the full text of the fate card** (including the consequences of YES/NO/target) when asked? They can't vote sensibly without it. Also check what the game rules say about vote procedure — the rulebook only says votes are "resolved now, before any dice are rolled" and fame-weighted; simultaneity/secrecy isn't specified in the rules either (may deserve a rulebook clarification too).

## 5. Fate card content in the dice action prompt

The current-board-state section of the dice action request says e.g. "Fate card this round: Grand Tourney" — **name only**. Verify whether the card's actual effect text is provided elsewhere in the prompt; if not, add it. An AI can't factor in "no boat movement this round" from the name alone.

## 6. AI food-tax planning failures (prompt tuning)

Players lost dice to the 2-food dice tax roughly **19 times across 18 rounds** — Opus lost dice in 6 of the last 7 rounds despite an 8-tile economy. The AIs repeatedly wrote "keep 2 food for next round's dice tax" in their plans and then sold or spent down to zero food anyway. The tax itself is intended design (human players plan around it routinely). Options:

- Add an explicit reminder to the harvest/decision prompts: current food vs. next round's tax cost, e.g. "You have N knights; rolling all dice next round costs X food; you currently have Y."
- Or accept it as a model-capability limitation and note it when reading AI playtest results.

## 7. AI never used special-tile parking (prompt tuning)

No AI ever parked a knight at the mercenary camp or temple to convert resources round after round — a pattern human players use routinely. All four models also never bought a trader item other than the Spear, never built a chapel, and never bought a second boat. Some of this is this match's meta (gold hoarding punishes spending), but the prompts may under-signal these standing options. Consider mentioning repeat-use special-tile strategies in the prompts, or verify against a human game before concluding anything design-wise.

## 8. Doomspire impression check timing — interim rule decided, simulator needs updating

**Interim decision (2026-07-21, pending codesigner discussion):** the impression check happens **when a knight enters the Doomspire tile, or at the end of the owner's turn in the movement phase for knights camped there** (no action die needed; a player who already impressed this round is skipped — the dragon dozes). Chosen as the simplest rule to learn and run. `docs/game-rules.md` and the cheat sheet have been updated to say this. See `playtest-analysis.md` §3.1 for the full option list still under discussion.

**TODO:**
- Update the simulator: it currently fires the check **at the start of the camping knight's owner's move turn**, before the player can act. It should instead fire at the **end of the owner's move turn**, so the owner can evacuate or repair the condition with their dice first.
- Until the simulator is changed, the deviation is documented in `simulator-notes-for-ai.md` so AI players aren't misled.
- Note: three knights died in this match under the old start-of-turn interpretation; under end-of-owner's-turn the owner can always walk a doomed knight away.

## 9. Doomspire PVP winner's "ride home" option — implemented?

Per the rules, a knight who kicks an opposing knight out of Doomspire may choose to fly home instead of facing the dragon. **Round 15 suggests this may not be offered:** Sonnet's plan explicitly said she would decline the dragon and take the ride home after beating Fable's knight — but Fable's knight *fled* (rather than fought), and Sonnet was then forced into the dragon fight and eaten. Two things to check:

- Is the ride-home choice implemented at all after a PVP win at Doomspire?
- Rules gap: does the ride-home offer also apply when the defender **flees** instead of losing combat? (Sonnet "got rid of the pesky knight" either way — the rules only say "if you win.")

## 10. UI: show followers on champions

Items are shown on champions in the UI — verify followers (Witch, Brawler) are displayed the same way. They affect combat math and are invisible otherwise.

## 11. UI: visualize dragon impressions on the board

Show each player's impression count (0/2, 1/2) somewhere visible on the board/player boxes — it's the single most important stat in the endgame and currently only lives in the game state text.

## 12. Noisy FAILED entries in harvest decisions — find the root cause

The logs are full of failures like `FAILED market: No resources to sell`, `FAILED build_fletcher: Already has fletcher`, `FAILED market: No market building` — this happens very often. Investigate why: does the harvest-decision schema/prompt encourage the AI to always fill in a market/building action even when invalid? Either tighten the schema (only offer valid options), fix the prompt, or filter these from the log so real failures stand out.

## 13. Reasoning-text artifacts leaked into actions (LLM output handling)

- **Round 6, Fable:** action reason contained `Wait - correcting: my plan is to claim the gold tile at (5,6)...` — and the move that executed was the *wrong* one (champion2 went to his own ore tile at (6,7) instead of (5,6)), costing him a turn and nearly the gold tile.
- **Round 7, Fable:** reason text contained `दWait — that JSON had a typo. Correcting: {.` — malformed JSON fragments surfacing in the log.

Suggests the action-parsing path sometimes accepts a first-draft action while the model was self-correcting. Worth checking schema validation / whether the model should get a repair-retry instead of partial execution.
