#!/usr/bin/env node

import { config } from "dotenv";
import { writeFileSync } from "fs";
import OpenAI from "openai";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, ".env") });

const OPENAI_MODEL = "gpt-image-2";
const OPENAI_DEFAULT_SIZE = "1024x1024";

class ImageGenerator {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ Error: OPENAI_API_KEY not found in .env file");
      console.error("Please create a .env file with your OpenAI API key:");
      console.error("OPENAI_API_KEY=your_api_key_here");
      process.exit(1);
    }

    this.openai = new OpenAI({ apiKey });
  }

  async generateImage(prompt, outputPath = null) {
    try {
      console.log(
        `🎨 Generating image with prompt: "${prompt.substring(0, 100)}${
          prompt.length > 100 ? "..." : ""
        }"`
      );
      console.log("⏳ Please wait...");

      const response = await this.openai.images.generate({
        model: OPENAI_MODEL,
        prompt: prompt,
        size: OPENAI_DEFAULT_SIZE,
        quality: "medium", // low = fast drafts, high = final assets
        n: 1,
      });

      const imageData = response.data[0];

      if (!imageData.b64_json) {
        throw new Error("No image data received from OpenAI");
      }

      // Generate filename
      const filename = outputPath || `generated-${uuidv4()}.png`;
      const filepath = join(__dirname, "output", filename);

      // Create output directory if it doesn't exist
      const { mkdirSync } = await import("fs");
      try {
        mkdirSync(join(__dirname, "output"), { recursive: true });
      } catch (err) {
        // Directory might already exist
      }

      // Convert base64 to buffer and save
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      writeFileSync(filepath, imageBuffer);

      console.log("✅ Image generated successfully!");
      console.log(`📁 Saved to: ${filepath}`);

      if (imageData.revised_prompt) {
        console.log(`📝 Revised prompt: ${imageData.revised_prompt}`);
      }

      return filepath;
    } catch (error) {
      console.error("❌ Failed to generate image:", error.message);
      throw error;
    }
  }
}

// CLI Interface
function showUsage() {
  console.log(`
🎨 Doomspire Asset Generator

Usage:
  node generate-image.js "your image prompt here"
  node generate-image.js "your prompt" --output filename.png

Examples:
  node generate-image.js "a medieval castle on a cliff"
  node generate-image.js "fantasy dragon breathing fire" --output dragon.png
  node generate-image.js "wooden treasure chest with gold coins spilling out"

Options:
  --output, -o    Specify output filename (optional)
  --help, -h      Show this help message

Note: Make sure to create a .env file with your OPENAI_API_KEY
    `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  // Parse arguments
  let prompt = "";
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputPath = args[i + 1];
      i++; // Skip next argument
    } else if (!args[i].startsWith("--")) {
      prompt = args[i];
    }
  }

  if (!prompt) {
    console.error("❌ Error: Please provide a prompt");
    showUsage();
    process.exit(1);
  }

  try {
    const generator = new ImageGenerator();
    await generator.generateImage(prompt, outputPath);
  } catch (error) {
    console.error("❌ Generation failed:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
