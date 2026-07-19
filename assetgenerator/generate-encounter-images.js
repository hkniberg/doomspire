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
const SIZE = "1024x1024"; // Square format for encounter cards
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";
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

  // Helper function to convert encounter id to filename
  encounterIdToFilename(encounterId) {
    return encounterId + ".png";
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

      // Extract individual encounter objects - need to handle nested braces properly
      const encounters = [];
      let braceCount = 0;
      let currentEncounter = "";
      let inEncounter = false;

      for (let i = 0; i < encountersArrayContent.length; i++) {
        const char = encountersArrayContent[i];

        if (char === "{") {
          if (!inEncounter) {
            inEncounter = true;
            currentEncounter = "";
          }
          braceCount++;
          currentEncounter += char;
        } else if (char === "}") {
          braceCount--;
          currentEncounter += char;

          if (braceCount === 0 && inEncounter) {
            // We've found a complete encounter object
            const encounter = this.parseEncounterObject(currentEncounter);
            if (encounter) {
              encounters.push(encounter);
            }
            inEncounter = false;
            currentEncounter = "";
          }
        } else if (inEncounter) {
          currentEncounter += char;
        }
      }

      return encounters;
    } catch (error) {
      console.error(
        "❌ Error loading encounters from encounterCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Helper method to parse a single encounter object string
  parseEncounterObject(encounterString) {
    try {
      // Handle both single and double quotes for id
      const idMatch = encounterString.match(/id:\s*["']([^"']+)["']/);
      const nameMatch = encounterString.match(/name:\s*["']([^"']+)["']/);

      // Handle description with template literals (backticks) and regular quotes
      const descriptionMatch = encounterString.match(
        /description:\s*[`"']([\s\S]*?)[`"']\s*,/
      );

      const tierMatch = encounterString.match(/tier:\s*(\d+)/);
      const followerMatch = encounterString.match(/follower:\s*(true|false)/);

      // Extract imagePromptGuidance if present
      const guidanceMatch = encounterString.match(
        /imagePromptGuidance:\s*["']([^"']+)["']/
      );

      if (
        !idMatch ||
        !nameMatch ||
        !descriptionMatch ||
        !tierMatch ||
        !followerMatch
      ) {
        console.warn(
          "Could not parse encounter:",
          encounterString.substring(0, 100) + "..."
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
        id: idMatch[1],
        name: nameMatch[1],
        description: description,
        tier: parseInt(tierMatch[1]),
        follower: followerMatch[1] === "true",
        imagePromptGuidance: guidanceMatch ? guidanceMatch[1] : undefined,
      };
    } catch (error) {
      console.error("Error parsing encounter object:", error.message);
      return null;
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
      const expectedFilename = this.encounterIdToFilename(encounter.id).replace(
        ".png",
        ""
      );
      return !existingImages.includes(expectedFilename);
    });

    return missingEncounters;
  }

  async generatePromptWithClaude(encounter) {
    // Create card info section
    let cardInfo = `Name: ${encounter.name}
Description: ${encounter.description}`;

    // Add imagePromptGuidance if available
    if (encounter.imagePromptGuidance) {
      cardInfo += `
Image Guidance: ${encounter.imagePromptGuidance}`;
      console.log(
        `✨ Using imagePromptGuidance for ${encounter.name}: "${encounter.imagePromptGuidance}"`
      );
    } else {
      console.log(
        `📝 No imagePromptGuidance found for ${encounter.name}, using generic template`
      );
    }

    // Log the complete card info being used
    console.log(`📋 Card info for ${encounter.name}:`);
    console.log("─".repeat(40));
    console.log(cardInfo);
    console.log("─".repeat(40));

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

  async generateImage(prompt, encounterId) {
    try {
      console.log(`🎨 Generating image for "${encounterId}"...`);

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
      const filename = this.encounterIdToFilename(encounterId);
      const filepath = join(encountersDir, filename);

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${encounterId}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${encounterId}":`,
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
      const imagePath = await this.generateImage(detailedPrompt, encounter.id);

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
          return {
            encounter: encounter.id,
            encounterName: encounter.name,
            prompt,
            success: true,
          };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${encounter.name}:`,
            error.message
          );
          return {
            encounter: encounter.id,
            encounterName: encounter.name,
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
      successfulPrompts.forEach(({ encounterName, prompt }) => {
        console.log(`\n🤝 ${encounterName}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(
        async ({ encounter, encounterName, prompt }) => {
          try {
            await this.generateImage(prompt, encounter);
            return { encounter, encounterName, success: true };
          } catch (error) {
            console.error(
              `❌ Failed to generate image for ${encounterName}:`,
              error.message
            );
            return {
              encounter,
              encounterName,
              success: false,
              error: error.message,
            };
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
      successful.forEach((r) =>
        console.log(`  - ${r.encounterName} (${r.encounter})`)
      );

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) =>
          console.log(`  - ${r.encounterName || r.encounter}: ${r.error}`)
        );
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
