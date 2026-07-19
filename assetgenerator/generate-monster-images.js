#!/usr/bin/env node

import { Anthropic } from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import OpenAI from "openai";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, ".env") });

const OPENAI_MODEL = "gpt-image-2";
const SIZE = "1024x1024"; // Landscape format for monsters
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";
const MAX_MONSTERS = 30; // For testing purposes

class MonsterImageGenerator {
  constructor() {
    // Check for required API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey) {
      console.error("❌ Error: OPENAI_API_KEY not found in .env file");
      process.exit(1);
    }

    if (!anthropicKey) {
      console.error("❌ Error: ANTHROPIC_API_KEY not found in .env file");
      process.exit(1);
    }

    this.openai = new OpenAI({ apiKey: openaiKey });
    this.anthropic = new Anthropic({ apiKey: anthropicKey });

    // Load the monster prompt template
    try {
      this.monsterPromptTemplate = readFileSync(
        join(__dirname, "prompts", "monster-prompt-template.md"),
        "utf-8"
      );
    } catch (error) {
      console.error("❌ Error: Could not read monster-prompt-template.md file");
      process.exit(1);
    }

    // Load the visual style template
    try {
      this.visualStyleTemplate = readFileSync(
        join(__dirname, "prompts", "visual-style.md"),
        "utf-8"
      );
    } catch (error) {
      console.error("❌ Error: Could not read visual-style.md file");
      process.exit(1);
    }
  }

  // Helper function to convert monster id to filename
  monsterIdToFilename(monsterId) {
    return monsterId.toLowerCase() + ".png";
  }

  // Load all monsters from monsterCards.ts
  loadMonstersFromFile() {
    try {
      const monsterCardsPath = join(
        __dirname,
        "..",
        "simulation",
        "src",
        "content",
        "monsterCards.ts"
      );
      const fileContent = readFileSync(monsterCardsPath, "utf-8");

      // Extract monsters using regex to find the MONSTER_CARDS array
      const monstersMatch = fileContent.match(
        /export const MONSTER_CARDS: MonsterCard\[\] = \[([\s\S]*?)\];/
      );
      if (!monstersMatch) {
        throw new Error(
          "Could not find MONSTER_CARDS array in monsterCards.ts"
        );
      }

      // Parse the monsters array content to extract monster objects
      const monstersArrayContent = monstersMatch[1];

      // Extract individual monster objects - need to handle nested braces properly
      const monsters = [];
      let braceCount = 0;
      let currentMonster = "";
      let inMonster = false;

      for (let i = 0; i < monstersArrayContent.length; i++) {
        const char = monstersArrayContent[i];

        if (char === "{") {
          if (!inMonster) {
            inMonster = true;
            currentMonster = "";
          }
          braceCount++;
          currentMonster += char;
        } else if (char === "}") {
          braceCount--;
          currentMonster += char;

          if (braceCount === 0 && inMonster) {
            // We've found a complete monster object
            const monster = this.parseMonsterObject(currentMonster);
            if (monster) {
              monsters.push(monster);
            }
            inMonster = false;
            currentMonster = "";
          }
        } else if (inMonster) {
          currentMonster += char;
        }
      }

      return monsters;
    } catch (error) {
      console.error(
        "❌ Error loading monsters from monsterCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Helper method to parse a single monster object string
  parseMonsterObject(monsterString) {
    try {
      // Handle both single and double quotes for id
      const idMatch = monsterString.match(/id:\s*["']([^"']+)["']/);
      const nameMatch = monsterString.match(/name:\s*["']([^"']+)["']/);
      const tierMatch = monsterString.match(/tier:\s*(\d+)/);

      // Extract imagePromptGuidance if present
      const guidanceMatch = monsterString.match(
        /imagePromptGuidance:\s*["']([^"']+)["']/
      );

      if (!idMatch || !nameMatch || !tierMatch) {
        console.warn(
          "Could not parse monster:",
          monsterString.substring(0, 100) + "..."
        );
        return null;
      }

      const monsterId = idMatch[1];
      const monsterName = nameMatch[1];

      return {
        id: monsterId,
        name: monsterName,
        tier: parseInt(tierMatch[1]),
        imagePromptGuidance: guidanceMatch ? guidanceMatch[1] : undefined,
      };
    } catch (error) {
      console.error("Error parsing monster object:", error.message);
      return null;
    }
  }

  // Get existing monster images
  getExistingMonsterImages() {
    const monstersDir = join(
      __dirname,
      "..",
      "simulation",
      "public",
      "monsters"
    );

    if (!existsSync(monstersDir)) {
      return [];
    }

    try {
      const files = readdirSync(monstersDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(".png", ""));
    } catch (error) {
      console.error("❌ Error reading monsters directory:", error.message);
      return [];
    }
  }

  // Find missing monster images
  findMissingMonsters() {
    const allMonsters = this.loadMonstersFromFile();
    const existingImages = this.getExistingMonsterImages();

    const missingMonsters = allMonsters.filter((monster) => {
      const expectedFilename = this.monsterIdToFilename(monster.id).replace(
        ".png",
        ""
      );
      return !existingImages.includes(expectedFilename);
    });

    return missingMonsters;
  }

  async generatePromptWithClaude(monster) {
    // Create card info section
    let cardInfo = `Name: ${monster.name}
Description: ${monster.description || "No description available"}`;

    // Add imagePromptGuidance if available
    if (monster.imagePromptGuidance) {
      cardInfo += `
Image Guidance: ${monster.imagePromptGuidance}`;
      console.log(
        `✨ Using imagePromptGuidance for ${monster.name}: "${monster.imagePromptGuidance}"`
      );
    } else {
      console.log(
        `📝 No imagePromptGuidance found for ${monster.name}, using generic template`
      );
    }

    // Log the complete card info being used
    console.log(`📋 Card info for ${monster.name}:`);
    console.log("─".repeat(40));
    console.log(cardInfo);
    console.log("─".repeat(40));

    // Substitute placeholders in the template (using regex to handle any whitespace variations)
    let templatePrompt = this.monsterPromptTemplate
      .replace(/\{\{\s*card-info\s*\}\}/g, cardInfo)
      .replace(/\{\{\s*visual-style\s*\}\}/g, this.visualStyleTemplate);

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: 5000,
        messages: [
          {
            role: "user",
            content: templatePrompt,
          },
        ],
      });

      const prompt = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      return prompt.trim();
    } catch (error) {
      console.error("❌ Failed to generate prompt with Claude:", error.message);
      throw error;
    }
  }

  async generateImage(prompt, monsterId) {
    try {
      console.log(`🎨 Generating image for "${monsterId}"...`);

      const finalPrompt =
        prompt + "\n\nIMPORTANT: Do not include any text in the image.";

      console.log("\n📝 Final prompt sent to OpenAI:");
      console.log("─".repeat(60));
      console.log(finalPrompt);
      console.log("─".repeat(60));

      const response = await this.openai.images.generate({
        model: OPENAI_MODEL,
        prompt: finalPrompt,
        size: SIZE,
        quality: "medium",
      });

      const imageData = response.data[0];

      if (!imageData.b64_json) {
        throw new Error("No image data received from OpenAI");
      }

      // Use the standardized naming format
      const filename = this.monsterIdToFilename(monsterId);
      const filepath = join(
        __dirname,
        "..",
        "simulation",
        "public",
        "monsters",
        filename
      );

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${monsterId}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${monsterId}":`,
        error.message
      );
      throw error;
    }
  }

  async generate(monsterName) {
    try {
      console.log(`🐉 Generating image for monster: "${monsterName}"`);

      // Find the monster by name
      const allMonsters = this.loadMonstersFromFile();
      const monster = allMonsters.find(
        (m) => m.name.toLowerCase() === monsterName.toLowerCase()
      );

      if (!monster) {
        throw new Error(
          `Monster "${monsterName}" not found in monsterCards.ts`
        );
      }

      // Step 1: Generate specific prompt with Claude
      const guidanceText = monster.imagePromptGuidance
        ? " (using image guidance)"
        : "";
      console.log(`🤖 Creating detailed prompt with Claude${guidanceText}...`);
      const detailedPrompt = await this.generatePromptWithClaude(monster);

      console.log("\n📝 Generated prompt:");
      console.log("─".repeat(60));
      console.log(detailedPrompt);
      console.log("─".repeat(60));

      // Step 2: Generate image with OpenAI
      const imagePath = await this.generateImage(detailedPrompt, monster.id);

      return imagePath;
    } catch (error) {
      console.error("❌ Monster image generation failed:", error.message);
      throw error;
    }
  }

  async generateAll() {
    try {
      console.log("🔍 Finding missing monster images...");

      const missingMonsters = this.findMissingMonsters();

      if (missingMonsters.length === 0) {
        console.log("✅ All monster images already exist!");
        return;
      }

      console.log(`📋 Found ${missingMonsters.length} missing monsters:`);
      missingMonsters.forEach((monster) =>
        console.log(`  - ${monster.name} (Tier ${monster.tier})`)
      );

      // Apply MAX_MONSTERS limit for testing
      const monstersToGenerate = missingMonsters.slice(0, MAX_MONSTERS);

      if (monstersToGenerate.length < missingMonsters.length) {
        console.log(
          `⚠️  Limited to ${MAX_MONSTERS} monsters for testing (MAX_MONSTERS = ${MAX_MONSTERS})`
        );
        console.log("📝 Generating images for:");
        monstersToGenerate.forEach((monster) =>
          console.log(`  - ${monster.name} (Tier ${monster.tier})`)
        );
      }

      // Step 1: Generate all prompts in parallel
      console.log(
        `\n🤖 Generating ${monstersToGenerate.length} prompts in parallel...`
      );

      const promptPromises = monstersToGenerate.map(async (monster) => {
        try {
          const guidanceText = monster.imagePromptGuidance
            ? " (with image guidance)"
            : "";
          console.log(
            `🤖 Creating prompt for "${monster.name}"${guidanceText}...`
          );
          const prompt = await this.generatePromptWithClaude(monster);
          return { monster: monster.id, prompt, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${monster.name}:`,
            error.message
          );
          return {
            monster: monster.id,
            success: false,
            error: error.message,
          };
        }
      });

      const promptResults = await Promise.all(promptPromises);

      // Filter out failed prompts
      const successfulPrompts = promptResults.filter((r) => r.success);
      const failedPrompts = promptResults.filter((r) => !r.success);

      if (failedPrompts.length > 0) {
        console.log(`⚠️  ${failedPrompts.length} prompts failed to generate:`);
        failedPrompts.forEach((r) =>
          console.log(`  - ${r.monster}: ${r.error}`)
        );
      }

      if (successfulPrompts.length === 0) {
        console.log(
          "❌ No prompts were successfully generated. Aborting image generation."
        );
        return;
      }

      // Show generated prompts
      console.log(`\n📝 Generated prompts:`);
      successfulPrompts.forEach(({ monster, prompt }) => {
        console.log(`\n🐉 ${monster}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(
        async ({ monster, prompt }) => {
          try {
            await this.generateImage(prompt, monster);
            return { monster, success: true };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${monster}:`,
              error.message
            );
            return { monster, success: false, error: error.message };
          }
        }
      );

      const imageResults = await Promise.all(imagePromises);

      // Report final results
      const successful = imageResults.filter((r) => r.success);
      const failed = [
        ...failedPrompts,
        ...imageResults.filter((r) => !r.success),
      ];

      console.log("\n📊 Generation Results:");
      console.log(`✅ Successful: ${successful.length}`);
      successful.forEach((r) => console.log(`  - ${r.monster}`));

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) => console.log(`  - ${r.monster}: ${r.error}`));
      }
    } catch (error) {
      console.error("❌ Batch generation failed:", error.message);
      throw error;
    }
  }
}

// CLI Interface
function showUsage() {
  console.log(`
🐉 Doomspire Monster Image Generator

Usage:
  node generate-monster-images.js "Monster Name"     # Generate single monster
  node generate-monster-images.js --all              # Generate all missing monsters

Examples:
  node generate-monster-images.js "Fire Dragon"
  node generate-monster-images.js "Shadow Wolf"
  node generate-monster-images.js --all

The --all option will:
1. Load all monsters from simulation/src/content/monsterCards.ts
2. Check existing images in simulation/public/monsters/
3. Generate missing monster images in parallel (limited by MAX_MONSTERS = ${MAX_MONSTERS})
4. Save images with format: <monster-name>.png
5. Use imagePromptGuidance field from monster cards when available for better image generation

Features:
- Automatically uses imagePromptGuidance from monster cards for more specific image generation
- Falls back to generic template when no guidance is provided
- Shows guidance status in console output

Requirements:
- OPENAI_API_KEY and ANTHROPIC_API_KEY in .env file
- monster-prompt-template.md and visual-style.md files in prompts/ directory
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  const generator = new MonsterImageGenerator();

  // Check for --all parameter
  if (args.includes("--all")) {
    try {
      await generator.generateAll();
    } catch (error) {
      console.error("❌ Batch generation failed:", error.message);
      process.exit(1);
    }
    return;
  }

  // Single monster generation
  const monsterName = args[0];

  if (!monsterName) {
    console.error("❌ Error: Please provide a monster name or use --all");
    showUsage();
    process.exit(1);
  }

  try {
    await generator.generate(monsterName);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
