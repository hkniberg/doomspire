import { TokenUsageTracker } from "@/lib/TokenUsageTracker";
import { Anthropic } from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import pRetry, { AbortError } from "p-retry";
import { extractLastJsonObject } from "./jsonExtraction";

/**
 * Selectable Claude model families for AI players.
 * Maps friendly names to Claude API model IDs (as of July 2026).
 */
export const CLAUDE_MODELS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
  fable: "claude-fable-5",
} as const;

export type ClaudeModel = keyof typeof CLAUDE_MODELS;

export const DEFAULT_CLAUDE_MODEL: ClaudeModel = "sonnet";

const DEFAULT_RESPONSE_TOKENS = 10000;
// Haiku 4.5 does not support adaptive thinking (400 error); it uses manual extended
// thinking with a fixed token budget instead. Sonnet 5, Opus 5, and Fable 5 all use
// adaptive thinking (and reject manual budgets with a 400 error).
const HAIKU_THINKING_BUDGET_TOKENS = 8000;
// Adaptive thinking tokens count toward max_tokens, so reserve headroom on top of the
// response budget requested by the caller. Without this, a long thinking phase can eat
// the entire budget and the response gets truncated before any text is produced.
// The headroom is deliberately generous: unused output tokens cost nothing, while a
// truncated response forces a costly and slow retry. The headroom is doubled on each
// retry attempt in case the model thinks past even this budget.
const THINKING_TOKEN_HEADROOM = 24000;
const MAX_RETRIES = 3;
const MIN_TIMEOUT_MS = 1000; // Start with 1 second
const MAX_TIMEOUT_MS = 8000; // Cap at 8 seconds
const BACKOFF_FACTOR = 2; // Double the delay each time
const MAX_TOTAL_OUTPUT_TOKENS = 64000; // Safety cap for max_tokens, even after retry escalation

// Helper function to log with timestamp
function log(label: string, content: any) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Claude ${label}:\n`, content);
}

export class Claude {
  private anthropic: Anthropic;
  private model: ClaudeModel;
  private systemMessage: string;
  private tokenUsageTracker?: TokenUsageTracker;

  constructor(apiKey: string, systemMessage: string, model: ClaudeModel = DEFAULT_CLAUDE_MODEL, tokenUsageTracker?: TokenUsageTracker) {
    this.anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
    this.systemMessage = systemMessage;
    this.tokenUsageTracker = tokenUsageTracker;
  }

  /**
   * Send a user message and get either a structured JSON response (if schema provided) or plain text response
   *
   * Note: Sonnet 5, Opus 5, and Fable 5 use adaptive thinking; manual thinking budgets
   * are rejected with a 400 error on those models. Haiku 4.5 is the opposite: it only
   * supports manual extended thinking with a fixed budget. The thinkingTokens parameter
   * is kept for call-site compatibility but is ignored (a fixed budget is used for Haiku).
   */
  async useClaude(
    userMessage: string,
    responseSchema?: any,
    thinkingTokens: number = 0,
    responseTokens: number = DEFAULT_RESPONSE_TOKENS,
    thinkingLogger?: (content: string) => void,
  ): Promise<any> {
    log("User Message", userMessage);

    // Haiku 4.5 only supports manual extended thinking (adaptive is rejected with a 400).
    // The other models only support adaptive thinking; "summarized" display makes the
    // reasoning readable so the thinkingLogger can surface it in the game log (raw chain
    // of thought is never returned on these models, and display defaults to "omitted").
    const thinkingConfig =
      this.model === "haiku"
        ? { type: "enabled", budget_tokens: HAIKU_THINKING_BUDGET_TOKENS }
        : { type: "adaptive", display: "summarized" };

    const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
      model: CLAUDE_MODELS[this.model],
      // Always cache the system message
      system: [
        {
          type: "text",
          text: this.systemMessage,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      thinking: thinkingConfig as any,
      max_tokens: responseTokens + THINKING_TOKEN_HEADROOM,
      // Structured outputs: when a schema is provided, the API constrains generation so the
      // text response is guaranteed to be valid JSON matching the schema (thinking is unaffected).
      ...(responseSchema
        ? { output_config: { format: { type: "json_schema" as const, schema: responseSchema } } }
        : {}),
    };

    // Define the operation that will be retried
    const operation = async (attemptNumber: number) => {
      try {
        // Double the thinking headroom on each retry, so a truncated attempt
        // gets significantly more room instead of failing the same way again
        const headroom = THINKING_TOKEN_HEADROOM * 2 ** (attemptNumber - 1);
        const maxTokens = Math.min(responseTokens + headroom, MAX_TOTAL_OUTPUT_TOKENS);

        // Use streaming: the SDK refuses non-streaming requests whose max_tokens implies a
        // potential runtime over 10 minutes, and our generous thinking headroom exceeds that.
        // finalMessage() accumulates the stream into the same Message shape as create().
        const stream = this.anthropic.messages.stream({ ...params, max_tokens: maxTokens });
        const response = await stream.finalMessage();

        // Track token usage if tracker is available
        if (this.tokenUsageTracker && response.usage) {
          this.tokenUsageTracker.addUsage({
            input_tokens: response.usage.input_tokens || undefined,
            cache_creation_input_tokens: response.usage.cache_creation_input_tokens || undefined,
            cache_read_input_tokens: response.usage.cache_read_input_tokens || undefined,
            output_tokens: response.usage.output_tokens || undefined,
          });
        }

        // Check for truncated thinking blocks (no text content)
        const textBlocks = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text");
        const thinkingBlocks = response.content.filter((block): block is Anthropic.ThinkingBlock => block.type === "thinking");

        if (textBlocks.length === 0 && thinkingBlocks.length > 0) {
          throw new Error(
            `Claude returned only truncated thinking blocks with no text response ` +
            `(stop_reason: ${response.stop_reason}, max_tokens: ${maxTokens}, output_tokens: ${response.usage?.output_tokens})`
          );
        }

        // Log each content block in sequence
        for (let i = 0; i < response.content.length; i++) {
          const block = response.content[i];
          log(
            `Content Block ${i + 1} (${block.type})`,
            block.type === "text"
              ? block.text
              : block.type === "thinking"
                ? block.thinking
                : block.type === "tool_use"
                  ? { id: block.id, name: block.name, input: block.input }
                  : block,
          );

          // Log thinking blocks using the thinkingLogger if provided
          if (block.type === "thinking" && thinkingLogger && "thinking" in block) {
            thinkingLogger(block.thinking);
          }
        }

        // Extract text content
        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");

        // If no schema provided, return raw text response
        if (!responseSchema) {
          return textContent;
        }

        // Try to parse JSON response
        try {
          const parsedResponse = JSON.parse(textContent.trim());
          log("Parsed Response", parsedResponse);
          return parsedResponse;
        } catch (parseError) {
          console.log("Claude response text content couldn't be parsed", JSON.stringify(textContent, null, 2));

          // Try to extract and repair JSON. If the model self-corrected mid-response,
          // the text may contain several JSON objects - the last balanced one is the
          // final answer. Fall back to first-{ / last-} extraction only if no balanced
          // object exists (e.g. the response was truncated mid-object).
          const lastBalancedObject = extractLastJsonObject(textContent);
          const jsonStartIndex = textContent.indexOf("{");
          const jsonEndIndex = textContent.lastIndexOf("}") + 1;
          const jsonContent = lastBalancedObject
            ?? (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex
              ? textContent.substring(jsonStartIndex, jsonEndIndex)
              : null);

          if (jsonContent === null) {
            throw new Error("Unable to find valid JSON markers in Claude's response");
          }

          try {
            const parsedResponse = JSON.parse(jsonrepair(jsonContent));
            console.warn("Warning: Had to trim Claude's response to extract valid JSON");
            log("Trimmed and Parsed Response", parsedResponse);
            return parsedResponse;
          } catch (innerError) {
            throw new Error(`Failed to parse JSON response even after trimming and repair: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`);
          }
        }

      } catch (error) {
        // Check if this is a retryable error
        const isRetryable =
          error instanceof Error && (
            error.message.includes("Claude returned only truncated thinking blocks") ||
            error.message.includes("Failed to parse JSON response") ||
            error.message.includes("Unable to find valid JSON markers") ||
            error.message.includes("529") ||
            error.message.includes("overloaded")
          );

        if (!isRetryable) {
          // AbortError tells p-retry to stop immediately (no retries) for fatal errors
          // such as an invalid API key or a malformed request.
          throw new AbortError(
            `Claude API error (attempt ${attemptNumber}): ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Plain errors are retried by p-retry with exponential backoff
        throw error;
      }
    };

    // Use p-retry to handle retries
    return pRetry(operation, {
      retries: MAX_RETRIES,
      onFailedAttempt: (error) => {
        console.warn(`Claude API error (attempt ${error.attemptNumber}/${MAX_RETRIES + 1}): ${error.message}`);
        console.log(`Retrying in ${MIN_TIMEOUT_MS * BACKOFF_FACTOR ** (error.attemptNumber - 1)}ms...`);
      },
      factor: BACKOFF_FACTOR, // Use exponential backoff
      minTimeout: MIN_TIMEOUT_MS,
      maxTimeout: MAX_TIMEOUT_MS,
    });
  }
}
