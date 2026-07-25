interface ClaimFlagProps {
  playerName: string;
  getPlayerColor: (playerName: string) => {
    main: string;
    light: string;
    dark: string;
  };
  isBlockaded?: boolean;
  blockadingPlayer?: string;
  isProtected?: boolean;
}

const FLAG_WIDTH = 42;
const FLAG_HEIGHT = 40;

// Outline of the pole and pennant combined, used to draw a single halo behind both.
const FLAG_SILHOUETTE = "M3,2 H8 V4 L36,12 L8,20 V38 H3 Z";
const POLE = "M3,2 H8 V38 H3 Z";
const PENNANT = "M8,4 L36,12 L8,20 Z";

const FlagGraphic = ({ color }: { color: string }) => (
  <svg
    width={FLAG_WIDTH}
    height={FLAG_HEIGHT}
    viewBox={`0 0 ${FLAG_WIDTH} ${FLAG_HEIGHT}`}
    style={{
      display: "block",
      filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.7))",
    }}
  >
    {/* White halo so the flag reads against dark and light terrain alike */}
    <path d={FLAG_SILHOUETTE} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={4} strokeLinejoin="round" />
    <path d={POLE} fill="#8B4513" />
    <path d={PENNANT} fill={color} />
    <path d={FLAG_SILHOUETTE} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} strokeLinejoin="round" />
  </svg>
);

export const ClaimFlag = ({
  playerName,
  getPlayerColor,
  isBlockaded = false,
  blockadingPlayer,
  isProtected = false,
}: ClaimFlagProps) => {
  const playerColors = getPlayerColor(playerName);
  const blockadingColors = blockadingPlayer ? getPlayerColor(blockadingPlayer) : null;

  const protectionIndicator = isProtected ? (
    <div
      style={{
        marginLeft: "4px",
        padding: "2px 4px",
        borderRadius: "4px",
        backgroundColor: playerColors.main,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8px",
        fontWeight: "bold",
        color: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        whiteSpace: "nowrap",
      }}
      title="This claim is protected by adjacent knights or warships"
    >
      P
    </div>
  ) : null;

  if (isBlockaded) {
    return (
      <div
        style={{
          width: `${FLAG_WIDTH}px`,
          height: `${FLAG_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Rotated flag container */}
        <div
          style={{
            transform: "rotate(90deg)",
            transformOrigin: "center",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <FlagGraphic color={playerColors.main} />
        </div>
        {/* Blockade indicator */}
        <div
          style={{
            marginLeft: "6px",
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: blockadingColors?.main || "#FF0000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            fontWeight: "bold",
            color: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          BLOCKADE
        </div>
        {protectionIndicator}
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${FLAG_WIDTH}px`,
        height: `${FLAG_HEIGHT}px`,
        display: "flex",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      <FlagGraphic color={playerColors.main} />
      {protectionIndicator}
    </div>
  );
};
