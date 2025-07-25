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
const SIZE = "1024x1024"; // Square format for event cards
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-0";
const MAX_EVENTS = 50; // For testing purposes

class EventImageGenerator {
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

    // Load the event prompt template
    try {
      this.eventPromptTemplate = readFileSync(
        join(__dirname, "prompts", "event-prompt-template.md"),
        "utf-8"
      );
    } catch (error) {
      console.error("❌ Error: Could not read event-prompt-template.md file");
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

  // Helper function to convert event name to filename
  eventNameToFilename(eventName) {
    return eventName.toLowerCase().replace(/\s+/g, "-") + ".png";
  }

  // Load all events from eventCards.ts
  loadEventsFromFile() {
    try {
      const eventCardsPath = join(
        __dirname,
        "..",
        "simulation",
        "src",
        "content",
        "eventCards.ts"
      );
      const fileContent = readFileSync(eventCardsPath, "utf-8");

      // Extract events using regex to find the EVENT_CARDS array
      const eventsMatch = fileContent.match(
        /export const EVENT_CARDS: EventCard\[\] = \[([\s\S]*?)\];/
      );
      if (!eventsMatch) {
        throw new Error("Could not find EVENT_CARDS array in eventCards.ts");
      }

      // Parse the events array content to extract event objects
      const eventsArrayContent = eventsMatch[1];

      // Extract individual event objects
      const eventMatches = eventsArrayContent.match(/\{[\s\S]*?\}/g);

      if (!eventMatches) {
        throw new Error(
          "Could not extract event objects from EVENT_CARDS array"
        );
      }

      const events = eventMatches
        .map((eventString) => {
          const nameMatch = eventString.match(/name: '([^']+)'/);
          const descriptionMatch = eventString.match(/description: '([^']+)'/);
          const tierMatch = eventString.match(/tier: (\d+)/);

          if (!nameMatch || !descriptionMatch || !tierMatch) {
            console.warn("Could not parse event:", eventString);
            return null;
          }

          return {
            name: nameMatch[1],
            description: descriptionMatch[1],
            tier: parseInt(tierMatch[1]),
          };
        })
        .filter((event) => event !== null);

      return events;
    } catch (error) {
      console.error(
        "❌ Error loading events from eventCards.ts:",
        error.message
      );
      throw error;
    }
  }

  // Get existing event images
  getExistingEventImages() {
    const eventsDir = join(__dirname, "..", "simulation", "public", "events");

    if (!existsSync(eventsDir)) {
      return [];
    }

    try {
      const files = readdirSync(eventsDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.replace(".png", ""));
    } catch (error) {
      console.error("❌ Error reading events directory:", error.message);
      return [];
    }
  }

  // Find missing event images
  findMissingEvents() {
    const allEvents = this.loadEventsFromFile();
    const existingImages = this.getExistingEventImages();

    const missingEvents = allEvents.filter((event) => {
      const expectedFilename = this.eventNameToFilename(event.name).replace(
        ".png",
        ""
      );
      return !existingImages.includes(expectedFilename);
    });

    return missingEvents;
  }

  async generatePromptWithClaude(event) {
    // Create card info section
    const cardInfo = `Name: ${event.name}
Description: ${event.description}`;

    // Substitute placeholders in the template (using regex to handle any whitespace variations)
    let templatePrompt = this.eventPromptTemplate
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

  async generateImage(prompt, eventName) {
    try {
      console.log(`🎨 Generating image for "${eventName}"...`);

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
        quality: "high",
      });

      const imageData = response.data[0];

      if (!imageData.b64_json) {
        throw new Error("No image data received from OpenAI");
      }

      // Ensure events directory exists
      const eventsDir = join(__dirname, "..", "simulation", "public", "events");

      if (!existsSync(eventsDir)) {
        mkdirSync(eventsDir, { recursive: true });
      }

      // Use the standardized naming format
      const filename = this.eventNameToFilename(eventName);
      const filepath = join(eventsDir, filename);

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log(`✅ "${eventName}" image saved to: ${filename}`);

      return filepath;
    } catch (error) {
      console.error(
        `❌ Failed to generate image for "${eventName}":`,
        error.message
      );
      throw error;
    }
  }

  async generate(eventName) {
    try {
      console.log(`🎭 Generating image for event: "${eventName}"`);

      // Find the event by name
      const allEvents = this.loadEventsFromFile();
      const event = allEvents.find(
        (e) => e.name.toLowerCase() === eventName.toLowerCase()
      );

      if (!event) {
        throw new Error(`Event "${eventName}" not found in eventCards.ts`);
      }

      // Step 1: Generate specific prompt with Claude
      console.log("🤖 Creating detailed prompt with Claude...");
      const detailedPrompt = await this.generatePromptWithClaude(event);

      console.log("\n📝 Generated prompt:");
      console.log("─".repeat(60));
      console.log(detailedPrompt);
      console.log("─".repeat(60));

      // Step 2: Generate image with OpenAI
      const imagePath = await this.generateImage(detailedPrompt, event.name);

      return imagePath;
    } catch (error) {
      console.error("❌ Event image generation failed:", error.message);
      throw error;
    }
  }

  async generateAll() {
    try {
      console.log("🔍 Finding missing event images...");

      const missingEvents = this.findMissingEvents();

      if (missingEvents.length === 0) {
        console.log("✅ All event images already exist!");
        return;
      }

      console.log(`📋 Found ${missingEvents.length} missing events:`);
      missingEvents.forEach((event) =>
        console.log(`  - ${event.name} (Tier ${event.tier})`)
      );

      // Apply MAX_EVENTS limit for testing
      const eventsToGenerate = missingEvents.slice(0, MAX_EVENTS);

      if (eventsToGenerate.length < missingEvents.length) {
        console.log(
          `⚠️  Limited to ${MAX_EVENTS} events for testing (MAX_EVENTS = ${MAX_EVENTS})`
        );
        console.log("📝 Generating images for:");
        eventsToGenerate.forEach((event) =>
          console.log(`  - ${event.name} (Tier ${event.tier})`)
        );
      }

      // Step 1: Generate all prompts in parallel
      console.log(
        `\n🤖 Generating ${eventsToGenerate.length} prompts in parallel...`
      );

      const promptPromises = eventsToGenerate.map(async (event) => {
        try {
          console.log(`🤖 Creating prompt for "${event.name}"...`);
          const prompt = await this.generatePromptWithClaude(event);
          return { event: event.name, prompt, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate prompt for ${event.name}:`,
            error.message
          );
          return { event: event.name, success: false, error: error.message };
        }
      });

      const promptResults = await Promise.all(promptPromises);

      // Filter out failed prompts
      const successfulPrompts = promptResults.filter((r) => r.success);
      const failedPrompts = promptResults.filter((r) => !r.success);

      if (failedPrompts.length > 0) {
        console.log(`⚠️  ${failedPrompts.length} prompts failed to generate:`);
        failedPrompts.forEach((r) => console.log(`  - ${r.event}: ${r.error}`));
      }

      if (successfulPrompts.length === 0) {
        console.log(
          "❌ No prompts were successfully generated. Aborting image generation."
        );
        return;
      }

      // Show generated prompts
      console.log(`\n📝 Generated prompts:`);
      successfulPrompts.forEach(({ event, prompt }) => {
        console.log(`\n🎭 ${event}:`);
        console.log("─".repeat(60));
        console.log(prompt);
        console.log("─".repeat(60));
      });

      // Step 2: Generate all images in parallel using the prompts
      console.log(
        `\n🎨 Generating ${successfulPrompts.length} images in parallel...`
      );

      const imagePromises = successfulPrompts.map(async ({ event, prompt }) => {
        try {
          await this.generateImage(prompt, event);
          return { event, success: true };
        } catch (error) {
          console.error(
            `❌ Failed to generate image for ${event}:`,
            error.message
          );
          return { event, success: false, error: error.message };
        }
      });

      const imageResults = await Promise.all(imagePromises);

      // Report final results
      const successful = imageResults.filter((r) => r.success);
      const failed = [
        ...failedPrompts,
        ...imageResults.filter((r) => !r.success),
      ];

      console.log("\n📊 Generation Results:");
      console.log(`✅ Successful: ${successful.length}`);
      successful.forEach((r) => console.log(`  - ${r.event}`));

      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach((r) => console.log(`  - ${r.event}: ${r.error}`));
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
🎭 Doomspire Event Image Generator

Usage:
  node generate-event-images.js "Event Name"     # Generate single event
  node generate-event-images.js --all            # Generate all missing events

Examples:
  node generate-event-images.js "Market day"
  node generate-event-images.js "Thug Ambush"
  node generate-event-images.js --all

The --all option will:
1. Load all events from simulation/src/content/eventCards.ts
2. Check existing images in simulation/public/events/
3. Generate missing event images in parallel (limited by MAX_EVENTS = ${MAX_EVENTS})
4. Save images with format: <event-name>.png

Requirements:
- OPENAI_API_KEY and ANTHROPIC_API_KEY in .env file
- image-style.md file in the same directory
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  const generator = new EventImageGenerator();

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

  // Single event generation
  const eventName = args[0];

  if (!eventName) {
    console.error("❌ Error: Please provide an event name or use --all");
    showUsage();
    process.exit(1);
  }

  try {
    await generator.generate(eventName);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
