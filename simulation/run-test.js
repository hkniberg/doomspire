// Simple runner for the Lords of Doomspire simulation
const { execSync } = require("child_process");
const yargs = require("yargs");

function runSingleTurn(extraArgs = []) {
  console.log("🎮 Running single turn test...\n");
  try {
    const argsStr = extraArgs.length > 0 ? ` ${extraArgs.join(" ")}` : "";
    execSync(`./node_modules/.bin/tsx src/cli/CLIRunner.ts --single-turn${argsStr}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("❌ Failed to run single turn test");
    process.exit(1);
  }
}

function runCompleteGame(extraArgs = []) {
  console.log("🎮 Running complete game simulation...\n");
  try {
    const argsStr = extraArgs.length > 0 ? ` ${extraArgs.join(" ")}` : "";
    execSync(`./node_modules/.bin/tsx src/cli/CLIRunner.ts${argsStr}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("❌ Failed to run complete game simulation");
    process.exit(1);
  }
}

function runSpecificTurns(numTurns, extraArgs = []) {
  console.log(`🎮 Running ${numTurns} turn(s) simulation...\n`);
  try {
    const argsStr = extraArgs.length > 0 ? ` ${extraArgs.join(" ")}` : "";
    execSync(`./node_modules/.bin/tsx src/cli/CLIRunner.ts --turns ${numTurns}${argsStr}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error(`❌ Failed to run ${numTurns} turn(s) simulation`);
    process.exit(1);
  }
}

const PLAYER_TYPE_CHOICES = [
  "random",
  "goal",
  "claude",
  "claude:haiku",
  "claude:sonnet",
  "claude:opus",
  "claude:fable",
];

// Configure yargs
const argv = yargs
  .usage("🎮 Lords of Doomspire Simulation Runner\n\nUsage: $0 <command> [options]")

  // Command options
  .option("single-turn", {
    alias: "s",
    type: "boolean",
    description: "Test one turn",
  })
  .option("complete", {
    alias: "c",
    type: "boolean",
    description: "Run complete game",
  })
  .option("turns", {
    alias: "t",
    type: "number",
    description: "Run X turns",
  })

  // Game configuration options
  .option("max-rounds", {
    type: "number",
    description: "Set maximum rounds for complete games",
  })
  .option("seed", {
    type: "number",
    description: "Set random seed for board generation",
  })

  // Starting resource options
  .option("gold", {
    type: "number",
    description: "Set starting gold for all players",
  })
  .option("fame", {
    type: "number",
    description: "Set starting fame for all players",
  })
  .option("might", {
    type: "number",
    description: "Set starting might for all players",
  })
  .option("food", {
    type: "number",
    description: "Set starting food for all players",
  })
  .option("wood", {
    type: "number",
    description: "Set starting wood for all players",
  })
  .option("ore", {
    type: "number",
    description: "Set starting ore for all players",
  })

  // Player configuration options
  // Claude players default to sonnet; pick a model with e.g. claude:haiku, claude:opus, claude:fable
  .option("p1", {
    choices: PLAYER_TYPE_CHOICES,
    description: "Player 1 type (random, claude[:model], or goal)",
  })
  .option("p2", {
    choices: PLAYER_TYPE_CHOICES,
    description: "Player 2 type (random, claude[:model], or goal)",
  })
  .option("p3", {
    choices: PLAYER_TYPE_CHOICES,
    description: "Player 3 type (random, claude[:model], or goal)",
  })
  .option("p4", {
    choices: PLAYER_TYPE_CHOICES,
    description: "Player 4 type (random, claude[:model], or goal)",
  })

  // Claude instructions
  .option("claude-instructions", {
    type: "string",
    description: "Set extra instructions for all Claude players",
  })

  // Help and examples
  .help("h")
  .alias("h", "help").epilog(`
Examples:
  $0 --single-turn                          # Test one turn
  $0 --turns 5                             # Run 5 turns
  $0 --complete                             # Run complete game
  $0 --single-turn --p1 claude             # 1 turn, Player 1 is Claude AI (sonnet)
  $0 --single-turn --p1 claude:opus        # 1 turn, Player 1 is Claude Opus
  $0 --complete --p1 random --p2 claude    # Complete game, mixed players
  $0 --complete --max-rounds 25            # Complete game with 25 max rounds
  $0 --complete --seed 12345               # Complete game with specific board layout
  $0 --turns 5 --p1 claude --p2 claude    # 5 turns, first 2 players are Claude AI
  $0 --complete --gold 10 --fame 5        # Complete game with starting resources
  $0 --turns 2 --food 3 --wood 2          # 2 turns with starting food and wood
  $0 --single-turn --might 3               # 1 turn with starting might
  $0 --single-turn --p1 claude --claude-instructions "Focus on aggressive expansion"

Environment Setup:
  Create a .env file with: ANTHROPIC_API_KEY=your_api_key_here
  This is required when using claude players
  `).argv;

// Build extra arguments array
const extraArgs = [];

// Add player arguments
if (argv.p1) extraArgs.push(`p1=${argv.p1}`);
if (argv.p2) extraArgs.push(`p2=${argv.p2}`);
if (argv.p3) extraArgs.push(`p3=${argv.p3}`);
if (argv.p4) extraArgs.push(`p4=${argv.p4}`);

// Add resource arguments
if (argv.gold !== undefined) extraArgs.push(`--gold ${argv.gold}`);
if (argv.fame !== undefined) extraArgs.push(`--fame ${argv.fame}`);
if (argv.might !== undefined) extraArgs.push(`--might ${argv.might}`);
if (argv.food !== undefined) extraArgs.push(`--food ${argv.food}`);
if (argv.wood !== undefined) extraArgs.push(`--wood ${argv.wood}`);
if (argv.ore !== undefined) extraArgs.push(`--ore ${argv.ore}`);

// Add claude instructions
if (argv.claudeInstructions) {
  extraArgs.push(`--claude-instructions "${argv.claudeInstructions}"`);
}

// Add other game configuration
if (argv.maxRounds !== undefined) extraArgs.push(`--max-rounds ${argv.maxRounds}`);
if (argv.seed !== undefined) extraArgs.push(`--seed ${argv.seed}`);

// Execute based on command
if (argv.singleTurn) {
  runSingleTurn(extraArgs);
} else if (argv.complete) {
  runCompleteGame(extraArgs);
} else if (argv.turns) {
  if (argv.turns < 1) {
    console.error("❌ Invalid number of turns. Please provide a positive integer.");
    process.exit(1);
  }
  runSpecificTurns(argv.turns, extraArgs);
} else {
  // No command specified, show help
  yargs.showHelp();
}
