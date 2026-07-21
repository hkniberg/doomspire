// Copies the canonical game rules (docs/game-rules.md) into public/prompts/
// so the AI players are always prompted with the current rules.
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..", "..", "docs", "game-rules.md");
const target = path.join(__dirname, "..", "public", "prompts", "game-rules.md");

const header = "<!-- AUTO-GENERATED: copied from docs/game-rules.md by scripts/sync-rules.js. Do not edit this copy. -->\n\n";
fs.writeFileSync(target, header + fs.readFileSync(source, "utf-8"));
console.log(`Synced ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}`);
