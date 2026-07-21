# Simulator Issues — observed in the Four Claudes match (2026-07-19)

Things to investigate in the simulator and AI prompts, separated from the game-design findings in `playtest-analysis.md`.

**Status update (2026-07-21): all items below have been addressed.** Each issue now carries a resolution note.

## 1. Action failures consumed dice / overload error handling — FIXED

- **Round 14, Sonnet:** two consecutive Anthropic API `overloaded_error` responses during her attack on Fable's knight at (2,5). Both failures **consumed her dice**, so the attack she had planned (and narrated) never resolved.
- **Round 12, Haiku:** `Dice action failed: Champion 1 not found for player Haiku` — she tried to command champion1, which had been eaten by the dragon in round 11. The die was consumed.
- **Round 13, Haiku:** `Dice action failed: Dice value 2 not found in remaining dice []` — the AI planned two actions but the first consumed all dice; the second failed against an empty pool.
- **Round 15, Haiku:** `Champion 2 has already interacted with a tile and cannot use more action dice this round` — similar category: the AI issued an illegal follow-up action.

**Resolution:** `GameMaster.executeOneDiceAction` now (1) **pre-validates** every dice action (champion exists, hasn't interacted, dice values available, lockdown) *before* any dice are consumed, so invalid actions are side-effect-free; (2) **retries once** with the rejection reason injected into the prompt (`previousError` in `TurnContext` → `<previous-action-rejected>` section in `diceAction.md`); (3) falls back to a **random legal action** (via `RandomPlayerAgent`) if the retry fails or the AI call itself fails (infra errors like `overloaded_error`, which `claude.ts` already retries 4x with backoff). Dice are only burned as an absolute last resort if even the random fallback fails. The old double-burn (consume + catch-burn) is gone.

## 2. Unresolved combat state after failed actions (engine bug) — FIXED

At the end of round 14, Sonnet's champion1 and Fable's champion2 were co-located on (2,5) with combat never resolved, after an API failure mid-combat.

**Resolution:** the defender's fight/flee decision in `fleeHandler.ts` (the uncaught `makeDecision` that caused this) now defaults to "fight" on agent failure instead of aborting combat mid-resolution. Additionally, `GameMaster.validateNoUnresolvedCombat` runs after every move phase and logs a loud `STATE WARNING` if enemy knights are ever co-located on a combat-eligible tile.

## 3. Duplicate champion IDs (state bug) — FIXED (was NOT already fixed)

Haiku lost champion1 while already having a champion2; the newly recruited champion was **also named champion2** (recruitment used `champions.length + 1`).

**Resolution:** `buildActionHandler.ts` now assigns `max(existing champion ids) + 1`, which cannot collide after a death.

## 4. Fate card votes — rules and implementation questions — FIXED

**Resolution (all three sub-questions):**

- **0-fame players are no longer prompted** — they are skipped and logged as a weight-0 abstention ("X abstains (0 fame, vote weight 0)").
- **Votes are now secret and simultaneous**: all votes are collected before any are logged, so later voters can no longer see earlier votes in their game log (previously votes were logged one at a time, mid-collection).
- **Voters now get the full fate card text** (name + effect) in the vote decision prompt, plus a note that votes are secret and simultaneous.
- **Rulebook clarified** (`docs/game-rules.md`, Fate cards section): votes are cast secretly and simultaneously, then revealed together; 0-fame players may abstain. Cheat sheet and `simulator-notes-for-ai.md` updated to match.

## 5. Fate card content in the dice action prompt — FIXED

The board-state section said e.g. "Fate card this round: Grand Tourney" — name only.

**Resolution:** `FateEffects` now stores `fateCardEffect`; the board state (`gameStateStringifier.formatGameSession`) and the strategic assessment prompt both render "Fate card this round: {name} - {effect text}".

## 6. AI food-tax planning failures (prompt tuning) — FIXED

Players lost dice to the 2-food dice tax roughly 19 times across 18 rounds despite planning to keep food.

**Resolution:** both the dice action prompt and the harvest decision prompt now include a computed reminder (`ClaudePlayer.buildFoodTaxReminder`): "with N knight(s) you roll N+1 dice next round... the other X cost 2 food each (Y food total). You currently have Z food - if you end this round with less than Y food, you will lose dice next round." (Accounts for the doubled-tax adventure card.)

## 7. AI never used special-tile parking (prompt tuning) — FIXED

**Resolution:** `strategicAssessment.md` tips now explicitly mention parking a knight at a special tile (mercenary camp / temple / trader) to use it round after round, and warn against gold hoarding vs buying trader items, a chapel, a second boat, or extra knights. Whether this changes AI behavior should be verified in the next AI playtest.

## 8. Doomspire impression check timing — FIXED (simulator now matches the rules)

The interim rule (check on entry, or at the **end** of the owner's move turn for camped knights) was already in `docs/game-rules.md` and the cheat sheet, but the simulator fired the check at the **start** of the owner's move turn.

**Resolution:** `handleDoomspireStayCheck` now runs at the end of the owner's move phase (after the dice loop), so the owner can evacuate or repair the impression condition first. Knights that already faced the dragon this round (entered/interacted with Doomspire during the move phase) are skipped, and the existing "already impressed this round → dragon dozes" skip still applies.

## 9. Doomspire PVP winner's "ride home" option — FIXED (both sub-issues)

- The ride-home choice **was** implemented after a PVP *win*, but not when the defender **fled** — which is what killed Sonnet in round 15.

**Resolution:** the combat handlers now report `defenderFled`, and `GameMaster` offers the ride home in both cases (win or successful defender flee). The rules gap is closed: `docs/game-rules.md` now says "If you win (or the defender flees), choose one: ...", and the cheat sheet says "won the fight, or they fled".

## 10. UI: show followers on champions — FIXED

**Resolution:** `PlayerInfoBox` now renders followers (Witch, Brawler, etc.) as mini encounter cards next to the champion's items, with a "Follower" tag.

## 11. UI: visualize dragon impressions on the board — FIXED

**Resolution:** each player's info box now shows "Impressions: X/2" (threshold from `GameSettings.DRAGON_IMPRESSIONS_TO_WIN`) next to Fame and Might, highlighted in red once above zero.

## 12. Noisy FAILED entries in harvest decisions — FIXED

Root cause: the AI often filled in the *optional* `sellAtMarket`/`buildAction` schema fields with zero amounts or invalid choices, and the handler treated any present field as an attempt.

**Resolution:** an all-zero `sellAtMarket` object is now treated as "not using the market" (a silent no-op, not a failure), and the schema descriptions for `sellAtMarket`, `useBlacksmith`, `useFletcher`, and `buildAction` now say to omit the field entirely when unused (and to only pick affordable build actions listed in the prompt). Genuine failures (no building, can't afford) are still logged.

## 13. Reasoning-text artifacts leaked into actions (LLM output handling) — FIXED

- **Round 6, Fable:** first-draft action executed while the correction lived only in the reason text.
- **Round 7, Fable:** malformed JSON fragments surfaced in the log.

**Resolution:** two layers. (1) The JSON repair fallback in `claude.ts` now extracts the **last balanced JSON object** from the response (the model's final answer after self-correction) instead of naively slicing from the first `{` to the last `}`, which merged drafts into junk. (2) The validate-and-retry loop from issue 1 catches schema-valid-but-illegal first drafts: an invalid action is rejected without consuming dice and the model is re-prompted with the rejection reason.
