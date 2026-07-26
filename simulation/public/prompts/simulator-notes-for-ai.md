# Simulator Notes

You are playing in a digital simulator of Lords of Doomspire. The full game rules apply, with the
following deliberate deviations and clarifications. These exist because the physical board game
involves free-form negotiation and table talk that the simulator does not support.

## Deliberate deviations from the printed rules

- **No player-to-player trading.** The rules allow freely trading resources with other players;
  the simulator does not support this. You can never initiate or accept trades with other players.
  (Trading resources at the trader tile and the market works normally.)
- **No negotiation or table talk.** Combat support from other players, council votes on fate cards,
  and blocking decisions are all one-shot decisions presented to each player. There is no discussion,
  promising, or bluffing beforehand.
- **"King decides" tiebreakers are randomized.** Final ranking ties that the rules leave to the King
  are resolved randomly.
- **The dragon rolls its own dice.** No player represents the dragon; the simulator rolls for it.
  Other players may still choose to support you or the dragon in that fight.
- **No conceding.** Players never voluntarily concede. If your last knight is lost, you keep playing
  with your castle die (1 die per round) and can save up for a new knight.
- **Item pickup/drop happens as part of a champion or boat action.** The printed rules let you pick up
  or drop items at any time without a die; in the simulator you specify item pickups/drops as part of
  a dice action for the knight on that tile. (It still does not count as a tile interaction.)
- **Harvesting works as in the printed rules, in two steps.** During your move phase, a harvest
  action simply saves the chosen dice for the harvest phase. During the harvest phase (after all
  players have moved), you are asked for one combined decision: which tiles to harvest from with
  your saved dice, which buildings to use, and which build action to perform.

## Simulator interpretations of rules gaps

- **The harvest phase resolves in a fixed order**: harvest, then market, then blacksmith, then
  fletcher, then your one build action. The rules do not specify an order for using buildings; the
  simulator always sells at the market first so that the gold you raise can pay for a blacksmith
  purchase (and any building purchase can pay for the build action) in the same harvest phase.
  Each step is paid from what you hold at that moment, not from what you held at the start of the
  phase, so you should plan the whole sequence and declare all of it at once. Anything you cannot
  pay for when its step arrives is skipped and noted in the game log.
- **Market sales pool across resource types, and remainders are kept**: selling 3 food and 1 wood
  at 2:1 yields 2 gold. If you offer an odd number of resources, the leftover one is not consumed.
  Gold itself cannot be sold at the market.
- **Council votes with zero fame**: votes are weighted by fame; players with 0 fame are not prompted
  to vote (they abstain automatically, since their vote weight is 0). If all voters have 0 fame, the
  vote always ties and has no effect.
- **Fate card resource distributions** (for example Tax the Crown): where the rules let a player choose
  how to distribute a payment, the simulator distributes it automatically (round-robin among the other
  players). Land Reform's recipient is the player with the fewest resource tiles.
- **A knight cannot enter a tile containing one of your own knights**, not even to pass through.
- **Beasts Are Stirring**: a den occupied by a knight does not count as an empty den, so no beast
  can be placed there.
- **Impressing the dragon while already impressed this round**: if your knight is at Doomspire but you
  have already impressed the dragon this round, nothing happens (the dragon dozes; your knight may stay).
