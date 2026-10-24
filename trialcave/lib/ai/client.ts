import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { anthropicApiKey } from "@/lib/env";

/**
 * Anthropic client + a typed tool-call helper (B11.1). Server-only.
 * Never logs document content or patient facts — only model, tokens, duration.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: anthropicApiKey() });
  return client;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface CallToolOptions<T> {
  model: string;
  system: string;
  content: Anthropic.MessageParam["content"];
  tool: Anthropic.Tool;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/**
 * Forces a single tool call, validates its input with zod, retries once on a
 * schema failure (appending the error), and retries transient HTTP errors with
 * backoff. Throws after exhausting retries.
 */
export async function callTool<T>(opts: CallToolOptions<T>): Promise<T> {
  const { model, system, tool, schema } = opts;
  const maxTokens = opts.maxTokens ?? 8000;
  const anthropic = getClient();

  let content = opts.content;
  let schemaRetryUsed = false;

  for (let attempt = 0; attempt < 4; attempt++) {
    const started = Date.now();
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        tools: [tool],
        // DECISION (B11.1): claude-sonnet-5-5 / haiku-5-5 reject forced tool_choice
        // ("tool"/"any" not supported). We use "auto"; with a single tool and a
        // clear instruction the model reliably emits a tool_use block. We nudge
        // it in the system prompt and fall back to a retry if it doesn't.
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content }],
      });

      const toolUse = message.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) {
        // Model answered in text instead of calling the tool. Retry once with a
        // firmer instruction before giving up.
        if (!schemaRetryUsed) {
          schemaRetryUsed = true;
          const asText = typeof content === "string" ? content : "";
          content = `${asText}\n\nYou MUST respond by calling the ${tool.name} tool. Do not answer in plain text.`;
          continue;
        }
        throw new Error("Model returned no tool_use block");
      }

      const parsed = schema.safeParse(toolUse.input);
      if (parsed.success) {
        console.log(
          `[ai] ${model} ok in=${message.usage.input_tokens} out=${message.usage.output_tokens} ms=${Date.now() - started}`,
        );
        return parsed.data;
      }

      // Schema failure: retry once with the error appended to the user message.
      if (!schemaRetryUsed) {
        schemaRetryUsed = true;
        const asText = typeof content === "string" ? content : "";
        content = `${asText}\n\nYour previous response failed validation: ${parsed.error.message}. Return a valid tool call.`;
        continue;
      }
      throw new Error(`Tool output failed schema validation: ${parsed.error.message}`);
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: unknown }).status)
          : undefined;
      const isLastAttempt = attempt === 3;
      if (status && RETRYABLE_STATUS.has(status) && !isLastAttempt) {
        const backoff = 1000 * 2 ** attempt;
        console.warn(`[ai] ${model} status ${status}, retrying in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("callTool exhausted retries");
}
