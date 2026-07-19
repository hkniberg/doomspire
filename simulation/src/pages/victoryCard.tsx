import Head from "next/head";
import styles from "../styles/CheatSheet.module.css";

export default function VictoryCard() {
  const victoryTitles = [
    { place: "1st", title: "King of Doomspire", color: "#FFD700" },
    { place: "2nd", title: "Hand of the King", color: "#C0C0C0" },
    { place: "3rd", title: "Master of Coin", color: "#CD7F32" },
    { place: "4th", title: "Court Jester", color: "#8B4513" },
  ];

  return (
    <>
      <Head>
        <title>Lords of Doomspire - Victory Card</title>
        <meta name="description" content="Victory ranking card for Lords of Doomspire board game" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header} style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1 className={styles.title}>LORDS OF DOOMSPIRE</h1>
          <h2 style={{ textAlign: "center", marginTop: "1rem", color: "#654321", fontSize: "1.5rem" }}>
            FINAL RANKING
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "2rem",
            gap: "1.5rem",
          }}
        >
          {victoryTitles.map((rank) => (
            <div
              key={rank.place}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                maxWidth: "600px",
                padding: "1.5rem 2rem",
                backgroundColor: "white",
                border: "3px solid #654321",
                borderRadius: "12px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                fontSize: "1.5rem",
                fontFamily: "Georgia, serif",
                fontWeight: "bold",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "3rem",
                    height: "3rem",
                    backgroundColor: rank.color,
                    borderRadius: "50%",
                    color: rank.place === "2nd" ? "#333" : "white",
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    textShadow: rank.place === "2nd" ? "none" : "1px 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {rank.place}
                </div>
                <div
                  style={{
                    color: "#654321",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {rank.title}
                </div>
              </div>

              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  border: "3px dashed #654321",
                  borderRadius: "8px",
                  backgroundColor: "#f9f9f9",
                }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
