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

const OPENAI_MODEL = "gpt-image-1";
const SIZE = "1024x1024"; // Square format for encounter cards
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-0";
const MAX_ENCOUNTERS = 50; // For testing purposes

class EncounterImageGenerator {
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

    // Load the encounter prompt template
    try {
      this.encounterPromptTemplate = readFileSync(
        join(__dirname, "prompts", "encounter-prompt-template.md"),
        "utf-8"
      );
    } catch (error) {
      console.error(
        "❌ Error: Could not read encounter-prompt-template.md file"
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

  // Helper function to convert encounter name to filename
  encounterNameToFilename(encounterName) {
    return encounterName.toLowerCase().replace(/\s+/g, "-") + ".png";
  }

  // Load all encounters from encounterCards.ts
  loadEncountersFromFile() {
    try {
      const encounterCardsPath = join(
        __dirname,
        "..",
        "simulation",
        "src",
        "content",
        "encounterCards.ts"
      );
      const fileContent = readFileSync(encounterCardsPath, "utf-8");

      // Extract encounters using regex to find the ENCOUNTERS array
      const encountersMatch = fileContent.match(
        /export const ENCOUNTERS: Encounter\[\] = \[([\s\S]*?)\];/
      );
      if (!encountersMatch) {
        throw new Error("Could not find ENCOUNTERS array in encounterCards.ts");
      }

      // Parse the encounters array content to extract encounter objects
      const encountersArrayContent = encountersMatch[1];

      // Extract individual encounter objects
      const encounterMatches = encountersArrayContent.match(/\{[\s\S]*?\}/g);

      if (!encounterMatches) {
        throw new Error(
          "Could not extract encounter objects from ENCOUNTERS array"
        );
      }

      const encounters = encounterMatches
        .map((encounterString) => {
          const nameMatch = encounterString.match(/name: ['"]([^'"]+)['"]/);
          const descriptionMatch = encounterString.match(
            /description: ['"]([^'"]*(?:[^'"\\]|\\.[^'"]*)*)['"]/
          );
          const tierMatch = encounterString.match(/tier: (\d+)/);
          const followerMatch = encounterString.match(/follower: (true|false)/);

          if (!nameMatch || !descriptionMatch || !tierMatch || !followerMatch) {
            console.warn("Could not parse encounter:", encounterString);
            return null;
          }

          return {
            name: nameMatch[1],
            description: descriptionMatch[1],
            tier: parseInt(tierMatch[1]),
            follower: followerMatch[1] === "true",
          };
        })
        .filter((encounter) => encounter !== null);

      return encounters;
    } catch (error) {
      console.error(
        "❌ Error loading encounters from encounterCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Get existing encounter images
  getExistingEncounterImages() {
    const encountersDir = join(
      __dirname,
      "..",
      "simulation",
      "public",
      "encounters"
    );

    if (!existsSync(encountersDir)) {
      return [];
    }

    try {
      const files = readdirSync(encountersDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(".png", ""));
    } catch (error) {
      console.error("❌ Error reading encounters directory:", error.message);
      return [];
    }
  }

  // Find missing encounter images
  findMissingEncounters() {
    const allEncounters = this.loadEncountersFromFile();
    const existingImages = this.getExistingEncounterImages();

    const missingEncounters = allEncounters.filter((encounter) => {
      const expectedFilename = this.encounterNameToFilename(
        encounter.name
      ).replace(".png", "");
      return !existingImages.includes(expectedFilename);
    });

    return missingEncounters;
  }

  async generatePromptWithClaude(encounter) {
    // Create card info section
    const cardInfo = `Name: ${encounter.name}
Description: ${encounter.description}`;

    // Substitute placeholders in the template (using regex to handle any whitespace variations)
    let templatePrompt = this.encounterPromptTemplate
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

  async generateImage(prompt, encounterName) {
    try {
      console.log(`🎨 Generating image for "${encounterName}"...`);

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

      // Ensure encounters directory exists
      const encountersDir = join(
        __dirname,
        "..",
        "simulation",
        "public",
        "encounters"
      );

      if (!existsSync(encountersDir)) {
        mkdirSync(encountersDir, { recursive: true });
      }

      // Use the standardized naming format
      const filename = this.encounterNameToFilename(encounterName);
      const filepath = join(encountersDir, filename);

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${encounterName}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${encounterName}":`,
        error.message
      );
      throw error;
    }
  }

  async generate(encounterName) {
    try {
      console.log(`🤝 Generating image for encounter: "${encounterName}"`);

      // Find the encounter by name
      const allEncounters = this.loadEncountersFromFile();
      const encounter = allEncounters.find(
        (e) => e.name.toLowerCase() === encounterName.toLowerCase()
      );

      if (!encounter) {
        throw new Error(
          `Encounter "${encounterName}" not found in encounterCards.ts`
        );
      }

      // Step 1: Generate specific prompt with Claude
      console.log("🤖 Creating detailed prompt with Claude...");
      const detailedPrompt = await this.generatePromptWithClaude(encounter);

      console.log("\n📝 Generated prompt:");
      console.log("─".repeat(60));
      console.log(detailedPrompt);
      console.log("─".repeat(60));

      // Step 2: Generate image with OpenAI
      const imagePath = await this.generateImage(
        detailedPrompt,
        encounter.name
      );

      return imagePath;
    } catch (error) {
      console.error("❌ Encounter image generation failed:", error.message);
      throw error;
    }
  }

  async generateAll() {
    try {
      console.log("🔍 Finding missing encounter images...");

      const missingEncounters = this.findMissingEncounters();

      if (missingEncounters.length === 0) {
        console.log("✅ All encounter images already exist!");
        return;
      }

      console.log(`📋 Found ${missingEncounters.length} missing encounters:`);
      missingEncounters.forEach((encounter) =>
        console.log(
          `  - ${encounter.name} (Tier ${encounter.tier}, ${
            encounter.follower ? "Follower" : "Non-follower"
          })`
        )
      );

      // Apply MAX_ENCOUNTERS limit for testing
      const encountersToGenerate = missingEncounters.slice(0, MAX_ENCOUNTERS);

      if (encountersToGenerate.length < missingEncounters.length) {
        console.log(
          `⚠️  Limited to ${MAX_ENCOUNTERS} encounters for testing (MAX_ENCOUNTERS = ${MAX_ENCOUNTERS})`
        );
        console.log("📝 Generating images for:");
        encountersToGenerate.forEach((encounter) =>
          console.log(
            `  - ${encounter.name} (Tier ${encounter.tier}, ${
              encounter.follower ? "Follower" : "Non-follower"
            })`
          )
        );
      }

      // Step 1: Generate all prompts in parallel
      console.log(
        `\n🤖 Generating ${encountersToGenerate.length} prompts in parallel...`
      );

      const promptPromises = encountersToGenerate.map(async (encounter) => {
        try {
          console.log(`🤖 Creating prompt for "${encounter.name}"...`);
          const prompt = await this.generatePromptWithClaude(encounter);
          return { encounter: encounter.name, prompt, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${encounter.name}:`,
            error.message
          );
          return {
            encounter: encounter.name,
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
          console.log(`  - ${r.encounter}: ${r.error}`)
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
      successfulPrompts.forEach(({ encounter, prompt }) => {
        console.log(`\n🤝 ${encounter}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(
        async ({ encounter, prompt }) => {
          try {
            await this.generateImage(prompt, encounter);
            return { encounter, success: true };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${encounter}:`,
              error.message
            );
            return { encounter, success: false, error: error.message };
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
      successful.forEach((r) => console.log(`  - ${r.encounter}`));

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) => console.log(`  - ${r.encounter}: ${r.error}`));
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
🤝 Doomspire Encounter Image Generator

Usage:
  node generate-encounter-images.js "Encounter Name"     # Generate single encounter
  node generate-encounter-images.js --all               # Generate all missing encounters

Examples:
  node generate-encounter-images.js "Old beggar"
  node generate-encounter-images.js "Proud Mercenary"
  node generate-encounter-images.js --all

The --all option will:
1. Load all encounters from simulation/src/content/encounterCards.ts
2. Check existing images in simulation/public/encounters/
3. Generate missing encounter images in parallel (limited by MAX_ENCOUNTERS = ${MAX_ENCOUNTERS})
4. Save images with format: <encounter-name>.png

Requirements:
- OPENAI_API_KEY and ANTHROPIC_API_KEY in .env file
- encounter-prompt-template.md and visual-style.md files in prompts/ directory
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  const generator = new EncounterImageGenerator();

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

  // Single encounter generation
  const encounterName = args[0];

  if (!encounterName) {
    console.error("❌ Error: Please provide an encounter name or use --all");
    showUsage();
    process.exit(1);
  }

  try {
    await generator.generate(encounterName);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
