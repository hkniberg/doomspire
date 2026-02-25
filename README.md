# Lords of Doomspire

A strategic board game design project with digital simulation for playtesting and AI-powered gameplay.

## What is this?

**Lords of Doomspire** is a 4-player strategic board game where players command knights to explore a dangerous island, gather resources, and ultimately defeat a dragon. This repository contains the complete game design and a TypeScript simulation system that supports both web UI and headless CLI execution for AI-powered playtesting, as well as asset generation and printing.

## Key Documentation

- **[Game Overview](docs/game-overview.md)** - Core game concept and mechanics
- **[Components & Setup](docs/components.md)** - What's in the box and game setup instructions

### Game Rules (Three Versions)

- **[Game Rules](docs/game-rules.md)** - Canonical version for the printed board game and human players (source of truth)
- **[Rules Change History](docs/history.md)** - Timeline of major rules changes across playtests
- **[Player Cheat Sheet](simulation/src/pages/cheat-sheet.tsx)** - Consolidated game reference cheat sheet, packaged as a web page. Deployed at https://doomspire.vercel.app/cheat-sheet
- **[AI Rules](simulation/public/prompts/game-rules-for-ai.md)** - AI-adapted rules with minor changes to work better in the simulator context

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key (for AI features)

### Installation

```bash
git clone <repository-url>
cd doomspire/simulation
npm install
```

### Running the Web UI

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter your Anthropic API key when prompted (stays local in browser).

### Running the Command Line Interface (CLI) Simulation

The CLI supports comprehensive argument parsing with automatic help text. Run `node run-test.js --help` for full documentation.

```bash
# Run a headless game simulation
node run-test.js

# Run a single turn for testing
node run-test.js --single-turn

# Run a specific number of turns
node run-test.js --turns 5

# Run a complete game
node run-test.js --complete

# Run a single turn with a Claude AI player (requires ANTHROPIC_API_KEY in .env)
node run-test.js --single-turn --p1 claude

# Run with extra instructions for Claude players
node run-test.js --single-turn --p1 claude --claude-instructions "Hoard gold"

# Run with starting resources for faster testing
node run-test.js --turns 3 --gold 10 --fame 5

# Run with specific player configurations
node run-test.js --complete --p1 claude --p2 random --p3 claude --p4 random
```

The CLI mode supports automated playtesting with AI players for game balance analysis. When using Claude players, make sure to set your `ANTHROPIC_API_KEY` in a `.env` file in the simulation directory.

## Live Demo

The simulation is deployed at: https://doomspire.vercel.app/

## Asset Generation

The project includes AI-powered tools for generating game assets in the `assetgenerator/` directory. See **[Asset Generator README](assetgenerator/README.md)** for detailed setup and usage instructions.

- **Monster Images**: Generate artwork for creature cards using AI
- **Event Images**: Create illustrations for event cards
- **Treasure Images**: Generate artwork for treasure items
- **Encounter Images**: Create character portraits for encounters
- **Trader Item Images**: Generate equipment and item artwork

### Using the Asset Generator

```bash
cd assetgenerator
npm install

# Generate images for specific card types
node generate-monster-images.js
node generate-event-images.js
node generate-treasure-images.js
node generate-encounter-images.js
node generate-traderItem-images.js
```

The generators use Claude AI to create detailed image prompts based on game content, then generate artwork using DALL-E. All generated assets are saved to the `output/` directory.

See `assetgenerator/README.md` for detailed setup instructions and API key requirements.
