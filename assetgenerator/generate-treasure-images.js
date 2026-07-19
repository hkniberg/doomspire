#!/usr/bin/env node

import { Anthropic } from "@anthropic-ai/sdk";
import { config } from "dotenv";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import OpenAI from "openai";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, ".env") });

const OPENAI_MODEL = "gpt-image-2";
const SIZE = "1024x1024"; // Square format for treasure cards
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";
const MAX_TREASURES = 30; // For testing purposes

class TreasureImageGenerator {
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

    // Load the treasure prompt template
    try {
      this.treasurePromptTemplate = readFileSync(
        join(__dirname, "prompts", "treasure-prompt-template.md"),
        "utf-8"
      );
    } catch (error) {
      console.error(
        "❌ Error: Could not read treasure-prompt-template.md file"
      );
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

  // Helper function to convert treasure id to filename
  treasureIdToFilename(treasureId) {
    return treasureId.toLowerCase() + ".png";
  }

  // Load all treasures from treasureCards.ts
  loadTreasuresFromFile() {
    try {
      const treasureCardsPath = join(
        __dirname,
        "..",
        "simulation",
        "src",
        "content",
        "treasureCards.ts"
      );
      const fileContent = readFileSync(treasureCardsPath, "utf-8");

      // Extract treasures using regex to find the TREASURE_CARDS array
      const treasuresMatch = fileContent.match(
        /export const TREASURE_CARDS: TreasureCard\[\] = \[([\s\S]*?)\];/
      );
      if (!treasuresMatch) {
        throw new Error(
          "Could not find TREASURE_CARDS array in treasureCards.ts"
        );
      }

      // Parse the treasures array content to extract treasure objects
      const treasuresArrayContent = treasuresMatch[1];

      // Extract individual treasure objects - need to handle nested braces properly
      const treasures = [];
      let braceCount = 0;
      let currentTreasure = "";
      let inTreasure = false;

      for (let i = 0; i < treasuresArrayContent.length; i++) {
        const char = treasuresArrayContent[i];

        if (char === "{") {
          if (!inTreasure) {
            inTreasure = true;
            currentTreasure = "";
          }
          braceCount++;
          currentTreasure += char;
        } else if (char === "}") {
          braceCount--;
          currentTreasure += char;

          if (braceCount === 0 && inTreasure) {
            // We've found a complete treasure object
            const treasure = this.parseTreasureObject(currentTreasure);
            if (treasure) {
              treasures.push(treasure);
            }
            inTreasure = false;
            currentTreasure = "";
          }
        } else if (inTreasure) {
          currentTreasure += char;
        }
      }

      return treasures;
    } catch (error) {
      console.error(
        "❌ Error loading treasures from treasureCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Helper method to parse a single treasure object string
  parseTreasureObject(treasureString) {
    try {
      // Handle both single and double quotes for id
      const idMatch = treasureString.match(/id:\s*(["'])([\s\S]*?)\1/);
      const nameMatch = treasureString.match(/name:\s*(["'])([\s\S]*?)\1/);

      // Handle description with template literals (backticks) and regular quotes
      const descriptionMatch = treasureString.match(
        /description:\s*[`"']([\s\S]*?)[`"']\s*,/
      );

      const tierMatch = treasureString.match(/tier:\s*(\d+)/);

      // Extract imagePromptGuidance if present
      const guidanceMatch = treasureString.match(
        /imagePromptGuidance:\s*["']([^"']+)["']/
      );

      if (!idMatch || !nameMatch || !descriptionMatch || !tierMatch) {
        console.warn(
          "Could not parse treasure:",
          treasureString.substring(0, 100) + "..."
        );
        return null;
      }

      // Clean up the description - remove extra whitespace and newlines
      let description = descriptionMatch[1]
        .replace(/\\n/g, "\n") // Convert escaped newlines
        .replace(/\\`/g, "`") // Convert escaped backticks
        .replace(/\\"/g, '"') // Convert escaped quotes
        .trim();

      return {
        id: idMatch[2],
        name: nameMatch[2],
        description: description,
        tier: parseInt(tierMatch[1]),
        imagePromptGuidance: guidanceMatch ? guidanceMatch[1] : undefined,
      };
    } catch (error) {
      console.error("Error parsing treasure object:", error.message);
      return null;
    }
  }

  // Get existing treasure images
  getExistingTreasureImages() {
    const treasuresDir = join(
      __dirname,
      "..",
      "simulation",
      "public",
      "treasures"
    );

    if (!existsSync(treasuresDir)) {
      return [];
    }

    try {
      const files = readdirSync(treasuresDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(".png", ""));
    } catch (error) {
      console.error("❌ Error reading treasures directory:", error.message);
      return [];
    }
  }

  // Find missing treasure images
  findMissingTreasures() {
    const allTreasures = this.loadTreasuresFromFile();
    const existingImages = this.getExistingTreasureImages();

    const missingTreasures = allTreasures.filter((treasure) => {
      const expectedFilename = this.treasureIdToFilename(treasure.id).replace(
        ".png",
        ""
      );
      return !existingImages.includes(expectedFilename);
    });

    return missingTreasures;
  }

  async generatePromptWithClaude(treasure) {
    // Create card info section
    let cardInfo = `Name: ${treasure.name}
Description: ${treasure.description}
Tier: ${treasure.tier}`;

    // Add imagePromptGuidance if available
    if (treasure.imagePromptGuidance) {
      cardInfo += `
Image Guidance: ${treasure.imagePromptGuidance}`;
      console.log(
        `✨ Using imagePromptGuidance for ${treasure.name}: "${treasure.imagePromptGuidance}"`
      );
    } else {
      console.log(
        `📝 No imagePromptGuidance found for ${treasure.name}, using generic template`
      );
    }

    // Log the complete card info being used
    console.log(`📋 Card info for ${treasure.name}:`);
    console.log("─".repeat(40));
    console.log(cardInfo);
    console.log("─".repeat(40));

    // Substitute placeholders in the template (using regex to handle any whitespace variations)
    let templatePrompt = this.treasurePromptTemplate
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

  async generateImage(prompt, treasureId) {
    try {
      console.log(`🎨 Generating image for "${treasureId}"...`);

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

      // Ensure treasures directory exists
      const treasuresDir = join(
        __dirname,
        "..",
        "simulation",
        "public",
        "treasures"
      );

      if (!existsSync(treasuresDir)) {
        mkdirSync(treasuresDir, { recursive: true });
      }

      // Use the standardized naming format
      const filename = this.treasureIdToFilename(treasureId);
      const filepath = join(treasuresDir, filename);

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${treasureId}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${treasureId}":`,
        error.message
      );
      throw error;
    }
  }

  async generate(treasureName) {
    try {
      console.log(`💎 Generating image for treasure: "${treasureName}"`);

      // Find the treasure by name
      const allTreasures = this.loadTreasuresFromFile();
      const treasure = allTreasures.find(
        (t) => t.name.toLowerCase() === treasureName.toLowerCase()
      );

      if (!treasure) {
        throw new Error(
          `Treasure "${treasureName}" not found in treasureCards.ts`
        );
      }

      // Step 1: Generate specific prompt with Claude
      console.log("🤖 Creating detailed prompt with Claude...");
      const detailedPrompt = await this.generatePromptWithClaude(treasure);

      console.log("\n📝 Generated prompt:");
      console.log("─".repeat(60));
      console.log(detailedPrompt);
      console.log("─".repeat(60));

      // Step 2: Generate image with OpenAI
      const imagePath = await this.generateImage(detailedPrompt, treasure.id);

      return imagePath;
    } catch (error) {
      console.error("❌ Treasure image generation failed:", error.message);
      throw error;
    }
  }

  async generateAll() {
    try {
      console.log("🔍 Finding missing treasure images...");

      const missingTreasures = this.findMissingTreasures();

      if (missingTreasures.length === 0) {
        console.log("✅ All treasure images already exist!");
        return;
      }

      console.log(`📋 Found ${missingTreasures.length} missing treasures:`);
      missingTreasures.forEach((treasure) =>
        console.log(`  - ${treasure.name} (Tier ${treasure.tier})`)
      );

      // Apply MAX_TREASURES limit for testing
      const treasuresToGenerate = missingTreasures.slice(0, MAX_TREASURES);

      if (treasuresToGenerate.length < missingTreasures.length) {
        console.log(
          `⚠️  Limited to ${MAX_TREASURES} treasures for testing (MAX_TREASURES = ${MAX_TREASURES})`
        );
        console.log("📝 Generating images for:");
        treasuresToGenerate.forEach((treasure) =>
          console.log(`  - ${treasure.name} (Tier ${treasure.tier})`)
        );
      }

      // Step 1: Generate all prompts in parallel
      console.log(
        `\n🤖 Generating ${treasuresToGenerate.length} prompts in parallel...`
      );

      const promptPromises = treasuresToGenerate.map(async (treasure) => {
        try {
          console.log(`🤖 Creating prompt for "${treasure.name}"...`);
          const prompt = await this.generatePromptWithClaude(treasure);
          return { treasure: treasure.id, prompt, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${treasure.name}:`,
            error.message
          );
          return {
            treasure: treasure.id,
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
          console.log(`  - ${r.treasure}: ${r.error}`)
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
      successfulPrompts.forEach(({ treasure, prompt }) => {
        console.log(`\n💎 ${treasure}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(
        async ({ treasure, prompt }) => {
          try {
            await this.generateImage(prompt, treasure);
            return { treasure, success: true };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${treasure}:`,
              error.message
            );
            return { treasure, success: false, error: error.message };
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
      successful.forEach((r) => console.log(`  - ${r.treasure}`));

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) => console.log(`  - ${r.treasure}: ${r.error}`));
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
💎 Doomspire Treasure Image Generator

Usage:
  node generate-treasure-images.js "Treasure Name"     # Generate single treasure
  node generate-treasure-images.js --all              # Generate all missing treasures

Examples:
  node generate-treasure-images.js "Broken Shield"
  node generate-treasure-images.js "A rusty sword"
  node generate-treasure-images.js "Mysterious Ring"
  node generate-treasure-images.js --all

The --all option will:
1. Load all treasures from simulation/src/content/treasureCards.ts
2. Check existing images in simulation/public/treasures/
3. Generate missing treasure images in parallel (limited by MAX_TREASURES = ${MAX_TREASURES})
4. Save images with format: <treasure-name>.png

Requirements:
- OPENAI_API_KEY and ANTHROPIC_API_KEY in .env file
- treasure-prompt-template.md and visual-style.md files in prompts/ directory
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  const generator = new TreasureImageGenerator();

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

  // Single treasure generation
  const treasureName = args[0];

  if (!treasureName) {
    console.error("❌ Error: Please provide a treasure name or use --all");
    showUsage();
    process.exit(1);
  }

  try {
    await generator.generate(treasureName);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
