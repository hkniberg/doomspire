// Verifies that the AI system prompt assembles correctly from the synced rules + simulator notes.
// Run with: ./node_modules/.bin/tsx scripts/prompt-smoke-test.ts
import * as fs from "fs/promises";
import * as path from "path";
import { TemplateProcessor } from "../src/lib/templateProcessor";

async function main() {
  const loader = async (p: string) =>
    fs.readFile(path.join(__dirname, "..", "public", p.replace(/^\//, "")), "utf-8");
  const tp = new TemplateProcessor(loader);
  const prompt = await tp.processTemplate("SystemPrompt", {});

  console.log("SystemPrompt length:", prompt.length);
  console.log("contains canonical rules:", prompt.includes("LORDS OF DOOMSPIRE - Rulebook"));
  console.log("contains simulator notes:", prompt.includes("Simulator Notes"));
  console.log("contains conquer for 2 fame:", prompt.includes("**Conquer** (2 fame)"));
  console.log("contains 17+ fame threshold:", prompt.includes("17+ Fame"));
}

main().catch((e) => { console.error(e); process.exit(1); });
