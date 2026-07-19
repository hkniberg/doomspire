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
const SIZE = "1024x1024"; // Square format for knights
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";
const MAX_KNIGHTS = 30; // For testing purposes

class KnightImageGenerator {
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

    // Load the knight prompt template
    try {
      this.knightPromptTemplate = readFileSync(
        join(__dirname, "prompts", "knight-prompt-template.md"),
        "utf-8"
      );
    } catch (error) {
      console.error("❌ Error: Could not read knight-prompt-template.md file");
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

  // Helper function to convert knight id to filename
  knightIdToFilename(knightId) {
    return knightId.toLowerCase() + ".png";
  }

  // Load all knights from knightCards.ts
  loadKnightsFromFile() {
    try {
      const knightCardsPath = join(
        __dirname,
        "..",
        "simulation",
        "src",
        "content",
        "knightCards.ts"
      );
      const fileContent = readFileSync(knightCardsPath, "utf-8");

      // Extract knights using regex to find the KNIGHT_CARDS array
      const knightsMatch = fileContent.match(
        /export const KNIGHT_CARDS: KnightCard\[\] = \[([\s\S]*?)\];/
      );
      if (!knightsMatch) {
        throw new Error("Could not find KNIGHT_CARDS array in knightCards.ts");
      }

      // Parse the knights array content to extract knight objects
      const knightsArrayContent = knightsMatch[1];

      // Extract individual knight objects - need to handle nested braces properly
      const knights = [];
      let braceCount = 0;
      let currentKnight = "";
      let inKnight = false;

      for (let i = 0; i < knightsArrayContent.length; i++) {
        const char = knightsArrayContent[i];

        if (char === "{") {
          if (!inKnight) {
            inKnight = true;
            currentKnight = "";
          }
          braceCount++;
          currentKnight += char;
        } else if (char === "}") {
          braceCount--;
          currentKnight += char;

          if (braceCount === 0 && inKnight) {
            // We've found a complete knight object
            const knight = this.parseKnightObject(currentKnight);
            if (knight) {
              knights.push(knight);
            }
            inKnight = false;
            currentKnight = "";
          }
        } else if (inKnight) {
          currentKnight += char;
        }
      }

      return knights;
    } catch (error) {
      console.error(
        "❌ Error loading knights from knightCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Helper method to parse a single knight object string
  parseKnightObject(knightString) {
    try {
      // Handle both single and double quotes for id
      const idMatch = knightString.match(/id:\s*["']([^"']+)["']/);
      const nameMatch = knightString.match(/name:\s*["']([^"']+)["']/);
      const descriptionMatch = knightString.match(
        /description:\s*["']([^"']+)["']/
      );

      // Extract imagePromptGuidance if present
      const guidanceMatch = knightString.match(
        /imagePromptGuidance:\s*["']([^"']+)["']/
      );

      if (!idMatch || !nameMatch) {
        console.warn(
          "Could not parse knight:",
          knightString.substring(0, 100) + "..."
        );
        return null;
      }

      const knightId = idMatch[1];
      const knightName = nameMatch[1];
      const knightDescription = descriptionMatch ? descriptionMatch[1] : "";

      return {
        id: knightId,
        name: knightName,
        description: knightDescription,
        imagePromptGuidance: guidanceMatch ? guidanceMatch[1] : undefined,
      };
    } catch (error) {
      console.error("Error parsing knight object:", error.message);
      return null;
    }
  }

  // Get existing knight images
  getExistingKnightImages() {
    const knightsDir = join(__dirname, "..", "simulation", "public", "knights");

    if (!existsSync(knightsDir)) {
      return [];
    }

    try {
      const files = readdirSync(knightsDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(".png", ""));
    } catch (error) {
      console.error("❌ Error reading knights directory:", error.message);
      return [];
    }
  }

  // Find missing knight images
  findMissingKnights() {
    const allKnights = this.loadKnightsFromFile();
    const existingImages = this.getExistingKnightImages();

    const missingKnights = allKnights.filter((knight) => {
      const expectedFilename = this.knightIdToFilename(knight.id).replace(
        ".png",
        ""
      );
      return !existingImages.includes(expectedFilename);
    });

    return missingKnights;
  }

  async generatePromptWithClaude(knight) {
    // Create card info section
    let cardInfo = `Name: ${knight.name}
Description: ${knight.description || "No description available"}`;

    // Add imagePromptGuidance if available
    if (knight.imagePromptGuidance) {
      cardInfo += `
Image Guidance: ${knight.imagePromptGuidance}`;
      console.log(
        `✨ Using imagePromptGuidance for ${knight.name}: "${knight.imagePromptGuidance}"`
      );
    } else {
      console.log(
        `📝 No imagePromptGuidance found for ${knight.name}, using generic template`
      );
    }

    // Log the complete card info being used
    console.log(`📋 Card info for ${knight.name}:`);
    console.log("─".repeat(40));
    console.log(cardInfo);
    console.log("─".repeat(40));

    // Substitute placeholders in the template (using regex to handle any whitespace variations)
    let templatePrompt = this.knightPromptTemplate
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

  async generateImage(prompt, knightId) {
    try {
      console.log(`🎨 Generating image for "${knightId}"...`);

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
      const filename = this.knightIdToFilename(knightId);
      const filepath = join(
        __dirname,
        "..",
        "simulation",
        "public",
        "knights",
        filename
      );

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${knightId}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${knightId}":`,
        error.message
      );
      throw error;
    }
  }

  async generate(knightName) {
    try {
      console.log(`⚔️ Generating image for knight: "${knightName}"`);

      // Find the knight by name
      const allKnights = this.loadKnightsFromFile();
      const knight = allKnights.find(
        (k) => k.name.toLowerCase() === knightName.toLowerCase()
      );

      if (!knight) {
        throw new Error(`Knight "${knightName}" not found in knightCards.ts`);
      }

      // Step 1: Generate specific prompt with Claude
      const guidanceText = knight.imagePromptGuidance
        ? " (using image guidance)"
        : "";
      console.log(`🤖 Creating detailed prompt with Claude${guidanceText}...`);
      const detailedPrompt = await this.generatePromptWithClaude(knight);

      console.log("\n📝 Generated prompt:");
      console.log("─".repeat(60));
      console.log(detailedPrompt);
      console.log("─".repeat(60));

      // Step 2: Generate image with OpenAI
      const imagePath = await this.generateImage(detailedPrompt, knight.id);

      return imagePath;
    } catch (error) {
      console.error("❌ Knight image generation failed:", error.message);
      throw error;
    }
  }

  async generateAll() {
    try {
      console.log("🔍 Finding missing knight images...");

      const missingKnights = this.findMissingKnights();

      if (missingKnights.length === 0) {
        console.log("✅ All knight images already exist!");
        return;
      }

      console.log(`📋 Found ${missingKnights.length} missing knights:`);
      missingKnights.forEach((knight) => console.log(`  - ${knight.name}`));

      // Apply MAX_KNIGHTS limit for testing
      const knightsToGenerate = missingKnights.slice(0, MAX_KNIGHTS);

      if (knightsToGenerate.length < missingKnights.length) {
        console.log(
          `⚠️  Limited to ${MAX_KNIGHTS} knights for testing (MAX_KNIGHTS = ${MAX_KNIGHTS})`
        );
        console.log("📝 Generating images for:");
        knightsToGenerate.forEach((knight) =>
          console.log(`  - ${knight.name}`)
        );
      }

      // Step 1: Generate all prompts in parallel
      console.log(
        `\n🤖 Generating ${knightsToGenerate.length} prompts in parallel...`
      );

      const promptPromises = knightsToGenerate.map(async (knight) => {
        try {
          const guidanceText = knight.imagePromptGuidance
            ? " (with image guidance)"
            : "";
          console.log(
            `🤖 Creating prompt for "${knight.name}"${guidanceText}...`
          );
          const prompt = await this.generatePromptWithClaude(knight);
          return { knight: knight.id, prompt, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${knight.name}:`,
            error.message
          );
          return {
            knight: knight.id,
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
          console.log(`  - ${r.knight}: ${r.error}`)
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
      successfulPrompts.forEach(({ knight, prompt }) => {
        console.log(`\n⚔️ ${knight}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(
        async ({ knight, prompt }) => {
          try {
            await this.generateImage(prompt, knight);
            return { knight, success: true };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${knight}:`,
              error.message
            );
            return { knight, success: false, error: error.message };
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
      successful.forEach((r) => console.log(`  - ${r.knight}`));

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) => console.log(`  - ${r.knight}: ${r.error}`));
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
⚔️ Doomspire Knight Image Generator

Usage:
  node generate-knight-images.js "Knight Name"     # Generate single knight
  node generate-knight-images.js --all              # Generate all missing knights
  node generate-knight-images.js --dry-run          # Show missing knights without generating

Examples:
  node generate-knight-images.js "Ser Nickathing"
  node generate-knight-images.js "Big Bob"
  node generate-knight-images.js --all
  node generate-knight-images.js --dry-run

The --all option will:
1. Load all knights from simulation/src/content/knightCards.ts
2. Check existing images in simulation/public/knights/
3. Generate missing knight images in parallel (limited by MAX_KNIGHTS = ${MAX_KNIGHTS})
4. Save images with format: <knight-id>.png
5. Use imagePromptGuidance field from knight cards when available for better image generation

Features:
- Automatically uses imagePromptGuidance from knight cards for more specific image generation
- Falls back to generic template when no guidance is provided
- Shows guidance status in console output

Requirements:
- OPENAI_API_KEY and ANTHROPIC_API_KEY in .env file
- knight-prompt-template.md and visual-style.md files in prompts/ directory
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  const generator = new KnightImageGenerator();

  // Check for --dry-run parameter (shows missing knights without generating)
  if (args.includes("--dry-run")) {
    try {
      const missingKnights = generator.findMissingKnights();

      if (missingKnights.length === 0) {
        console.log("✅ All knight images already exist!");
        return;
      }

      console.log(`📋 Found ${missingKnights.length} missing knights:`);
      missingKnights.forEach((knight) =>
        console.log(`  - ${knight.name} (id: ${knight.id})`)
      );
    } catch (error) {
      console.error("❌ Dry run failed:", error.message);
      process.exit(1);
    }
    return;
  }

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

  // Single knight generation
  const knightName = args[0];

  if (!knightName) {
    console.error("❌ Error: Please provide a knight name or use --all");
    showUsage();
    process.exit(1);
  }

  try {
    await generator.generate(knightName);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
