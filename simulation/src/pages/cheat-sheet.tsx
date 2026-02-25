import Head from "next/head";
import styles from "../styles/CheatSheet.module.css";

export default function CheatSheet() {
  return (
    <>
      <Head>
        <title>Lords of Doomspire - Game Reference</title>
        <meta name="description" content="Complete game reference for Lords of Doomspire board game" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>LORDS OF DOOMSPIRE</h1>
        </div>

        <div className={styles.twoColumn}>
          {/* Left Column */}
          <div className={styles.side}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>TURN STRUCTURE & ACTIONS</h3>
              <div className={styles.orderedList}>
                <div className={styles.listItem}>
                  <span className={styles.number}>1</span>
                  <div>
                    <strong>Roll Dice Phase</strong> <em>(Parallel)</em>
                    <ul className={styles.bulletList}>
                      <li>Rotate starting player token to next player</li>
                      <li>Roll 1 die for castle + 1 per knight</li>
                      <li>
                        <strong>Dice Tax</strong>: Pay 2 Food per die after first 2
                      </li>
                    </ul>
                  </div>
                </div>
                <div className={styles.listItem}>
                  <span className={styles.number}>2</span>
                  <div>
                    <strong>Move Phase</strong> <em>(Sequential from Starting Player)</em>
                    <ul className={styles.bulletList}>
                      <li>
                        <strong>Move Knight</strong>: Move up to die value + tile interaction
                      </li>
                      <li>
                        <strong>Move Boat</strong>: Move boat + optionally transport knight
                      </li>
                      <li>Can save dice for Harvest Phase</li>
                    </ul>
                  </div>
                </div>
                <div className={styles.listItem}>
                  <span className={styles.number}>3</span>
                  <div>
                    <strong>Harvest Phase</strong> <em>(Parallel)</em>
                    <ul className={styles.bulletList}>
                      <li>
                        <strong>Harvest</strong>: Collect from resource tiles (die value = how many tiles)
                      </li>
                      <li>
                        <strong>Use Buildings</strong>: Market, blacksmith, fletcher
                      </li>
                      <li>
                        <strong>Build</strong>: Buy knight/boat, build/upgrade buildings
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>MOVEMENT RULES</h3>
              <ul className={styles.bulletList}>
                <li>Horizontal/vertical only (no diagonal)</li>
                <li>Must stop when entering unexplored tile or tile with monster</li>
                <li>Cannot stop in same tile as other knights (except special tiles)</li>
                <li>Cannot pass through monster tiles</li>
                <li>Can pass through other knights (they may force combat)</li>
                <li>Cannot enter enemy home tiles</li>
                <li>One tile interaction per knight per turn</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>COMBAT BASICS</h3>

              <div className={styles.combatBlock}>
                <h4 className={styles.combatTitle}>vs Monsters:</h4>
                <ul className={styles.bulletList}>
                  <li>Roll 1D3 + Might + support</li>
                  <li>Win if ≥ monster's Might → gain rewards</li>
                  <li>Lose → return home, pay 1 resource or lose 1 Fame</li>
                </ul>
              </div>

              <div className={styles.combatBlock}>
                <h4 className={styles.combatTitle}>vs Knights:</h4>
                <ul className={styles.bulletList}>
                  <li>Both roll 2D3 + Might + support</li>
                  <li>Winner gains 1 Fame, stays in tile</li>
                  <li>Winner may steal 1 item + resources (half of loser's resource tiles, rounded up)</li>
                  <li>Loser returns home</li>
                </ul>
              </div>

              <div className={styles.supportNote}>
                <strong>Support:</strong> +2 per knight/warship within 1 tile (including diagonals)
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>FLEEING COMBAT</h3>
              <ul className={styles.bulletList}>
                <li>
                  <strong>Roll 1D3</strong>: 1=fail (fight), 2=flee to closest owned tile + lose 1 resource, 3=flee home
                  (no loss)
                </li>
              </ul>
            </section>
          </div>

          {/* Right Column */}
          <div className={styles.side}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>TERRITORIAL DISPUTES</h3>
              <div className={styles.buildingList}>
                <div className={styles.supportNote}>
                  <strong>Protection:</strong> Tiles with adjacent knights (no diagonals) cannot be blockaded or taken over
                </div>

                <div className={styles.building}>
                  <strong>Blockade Tile</strong>: Place knight on enemy tile → can harvest from it instead of owner
                </div>
                <div className={styles.building}>
                  <strong>Conquer</strong>: 2 Fame → Take over enemy tile by force
                </div>
                <div className={styles.building}>
                  <strong>Bribe</strong>: 2 Gold → Take over enemy tile through corruption
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>TILE INTERACTION</h3>
              <ul className={styles.bulletList}>
                <li>
                  <strong>Automatic</strong>: Explore unexplored tiles (+1 Fame), combat monsters/knights, draw
                  adventure cards
                </li>
                <li>
                  <strong>Voluntary</strong>: Use special locations, claim resource tiles, pick up/drop items
                </li>
                <li>
                  <strong>Adventure Tiles</strong>: Draw card, remove adventure token
                </li>
                <li>
                  <strong>Non-Combat Zones</strong>: Temple, Trader, Mercenary Camp (multiple knights allowed)
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>IMPRESSING THE DRAGON</h3>
              <ul className={styles.victoryList}>
                <li>
                  <strong>Fame</strong>: Have 15+ Fame
                </li>
                <li>
                  <strong>Economy</strong>: Own 4+ starred resource tiles
                </li>
                <li>
                  <strong>Gold</strong>: Have 12+ Gold
                </li>
                <li>
                  <strong>Combat</strong>: Defeat the Dragon (Might 8, rolls 2D3). Others may support you or the dragon.
                </li>
              </ul>
              <div className={styles.supportNote}>Failure = knight gets eaten</div>
              <div className={styles.supportNote}>Success = +1 impression, take treasure (if any). Knight stays at Doomspire.</div>
              <div className={styles.supportNote}>Must impress each round while at Doomspire, or be eaten. Max 1 per round.</div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>VICTORY & FINAL RANKING</h3>
              <div className={styles.buildingList}>
                <div className={styles.building}>
                  <strong>1. King of Doomspire</strong>: First to reach 3 dragon impressions
                </div>
                <div className={styles.building}>
                  <strong>2. Hand of the King</strong>: Most resource tiles (tiebreaker: starred tiles)
                </div>
                <div className={styles.building}>
                  <strong>3. Master of Coin</strong>: Most gold (tiebreaker: total resources)
                </div>
                <div className={styles.building}>
                  <strong>4. Court Jester</strong>: The remaining player (cleans up the game!)
                </div>
              </div>
              <div className={styles.supportNote}>Unresolved ties are decided by the King.</div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
