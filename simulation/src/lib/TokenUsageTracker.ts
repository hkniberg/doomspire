// Type-only import to avoid a runtime cycle (claude.ts imports this file)
import type { ClaudeModel } from "@/llm/claude";

interface ModelPricing {
  inputPerMillion: number;
  cacheCreationPerMillion: number;
  cacheReadPerMillion: number;
  outputPerMillion: number;
}

// USD per million tokens, per model (as of July 2026).
// Cache creation is 1.25x the input price, cache read is 0.1x.
const MODEL_PRICING: Record<ClaudeModel, ModelPricing> = {
  haiku: { inputPerMillion: 1.0, cacheCreationPerMillion: 1.25, cacheReadPerMillion: 0.1, outputPerMillion: 5.0 },
  sonnet: { inputPerMillion: 3.0, cacheCreationPerMillion: 3.75, cacheReadPerMillion: 0.3, outputPerMillion: 15.0 },
  opus: { inputPerMillion: 5.0, cacheCreationPerMillion: 6.25, cacheReadPerMillion: 0.5, outputPerMillion: 25.0 },
  fable: { inputPerMillion: 10.0, cacheCreationPerMillion: 12.5, cacheReadPerMillion: 1.0, outputPerMillion: 50.0 },
};

export class TokenUsageTracker {
  private pricing: ModelPricing;

  // Token counters
  private inputTokens = 0;
  private cacheCreationTokens = 0;
  private cacheReadTokens = 0;
  private outputTokens = 0;

  constructor(model: ClaudeModel = "sonnet") {
    this.pricing = MODEL_PRICING[model];
  }

  /**
   * Add token usage from a Claude API response
   */
  public addUsage(usage: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  }): void {
    console.log("Claude usage addUsage called", usage);
    this.inputTokens += usage.input_tokens || 0;
    this.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
    this.cacheReadTokens += usage.cache_read_input_tokens || 0;
    this.outputTokens += usage.output_tokens || 0;
  }

  /**
   * Get raw token counts
   */
  public getTokenCounts(): {
    inputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
  } {
    return {
      inputTokens: this.inputTokens,
      cacheCreationTokens: this.cacheCreationTokens,
      cacheReadTokens: this.cacheReadTokens,
      outputTokens: this.outputTokens,
    };
  }

  /**
   * Calculate costs in USD for each token type
   */
  public getCosts(): {
    inputCost: number;
    cacheCreationCost: number;
    cacheReadCost: number;
    outputCost: number;
    totalCost: number;
  } {
    const inputCost = (this.inputTokens / 1_000_000) * this.pricing.inputPerMillion;
    const cacheCreationCost = (this.cacheCreationTokens / 1_000_000) * this.pricing.cacheCreationPerMillion;
    const cacheReadCost = (this.cacheReadTokens / 1_000_000) * this.pricing.cacheReadPerMillion;
    const outputCost = (this.outputTokens / 1_000_000) * this.pricing.outputPerMillion;
    const totalCost = inputCost + cacheCreationCost + cacheReadCost + outputCost;

    return {
      inputCost,
      cacheCreationCost,
      cacheReadCost,
      outputCost,
      totalCost,
    };
  }

  /**
   * Reset all counters to zero
   */
  public reset(): void {
    this.inputTokens = 0;
    this.cacheCreationTokens = 0;
    this.cacheReadTokens = 0;
    this.outputTokens = 0;
  }

  /**
   * Get total token count across all types
   */
  public getTotalTokens(): number {
    return this.inputTokens + this.cacheCreationTokens + this.cacheReadTokens + this.outputTokens;
  }
}
