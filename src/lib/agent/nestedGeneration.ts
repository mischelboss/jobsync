import "server-only";

import {
  generateObject,
  streamText,
  type LanguageModel,
  type UIMessageStreamWriter,
} from "ai";
import type { z } from "zod";
import { AGENT_NESTED_STREAM_PART_TYPE } from "@/models/agent.model";
import { repairJsonText } from "@/lib/ai/repair-json";

export type NestedGenerationResult =
  | { status: "ok"; text: string }
  | { status: "incomplete" }
  | { status: "busy" }
  | { status: "failed" };

// One per request, created in buildAgentTools. Process-wide state would block
// one user behind another's generation.
export type NestedGenerationGuard = { running: boolean };

type NestedGenerationArgs = {
  model: LanguageModel;
  system: string;
  prompt: string;
  temperature: number;
  numCtx: number;
  timeoutMs: number;
  writer: UIMessageStreamWriter;
  toolCallId: string;
  abortSignal?: AbortSignal;
  guard: NestedGenerationGuard;
  label: string;
};

/**
 * The invariant half of an agent-as-tool: run a second generation with its own
 * context window, stream its tokens to the transcript, and report whether it
 * finished. Callers own everything that differs in KIND — ownership,
 * preprocessing, parsing, saving, and the tool's result shape.
 */
export async function runNestedGeneration({
  model,
  system,
  prompt,
  temperature,
  numCtx,
  timeoutMs,
  writer,
  toolCallId,
  abortSignal,
  guard,
  label,
}: NestedGenerationArgs): Promise<NestedGenerationResult> {
  // Terminal tools stop the loop after a step, not within one: the model can
  // still emit both nested tools in a single step, and two 180s sub-calls
  // serialize on Ollama past the 300s turn deadline, losing both.
  if (guard.running) return { status: "busy" };
  guard.running = true;

  // Own deadline, plus the outer turn's signal so closing the panel aborts
  // this too.
  const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (abortSignal) signals.push(abortSignal);

  let text = "";
  try {
    const sub = streamText({
      model,
      system,
      prompt,
      temperature,
      abortSignal: AbortSignal.any(signals),
      // Deliberately no think:true. These sub-calls have no tools, so
      // reasoning buys nothing and costs 30s. The chat loop enables it.
      providerOptions: { ollama: { options: { num_ctx: numCtx } } },
    });

    for await (const delta of sub.textStream) {
      text += delta;
      writer.write({
        type: AGENT_NESTED_STREAM_PART_TYPE,
        id: toolCallId,
        data: { delta },
        transient: true,
      });
    }

    // The stream running out is not the generation finishing, and neither
    // case throws: an abort ends textStream cleanly and rejects this promise,
    // and a body that stops without Ollama's done chunk resolves to "other".
    const finishReason = await sub.finishReason;
    if (finishReason !== "stop") return { status: "incomplete" };
  } catch (error) {
    console.error(`[agent-chat] ${label} generation failed:`, error);
    return { status: "failed" };
  } finally {
    guard.running = false;
  }

  return { status: "ok", text };
}

export type NestedObjectGenerationResult<T> =
  | { status: "ok"; object: T }
  | { status: "busy" }
  | { status: "failed" };

type NestedObjectGenerationArgs<T> = {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature: number;
  numCtx: number;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  guard: NestedGenerationGuard;
  label: string;
};

/**
 * The structured sibling of runNestedGeneration, for tools whose output is a
 * schema-shaped object rather than markdown.
 *
 * It shares the invariant half — the single-flight guard, its own deadline
 * alongside the turn's signal, and uniform failure labelling — but writes
 * nothing to the transcript: streaming raw JSON tokens at the user would be
 * noise, so the tool's running card covers progress and the result card
 * renders the finished object.
 *
 * There is no "incomplete" status here. streamText can stop mid-analysis and
 * still hand back usable prose; a truncated object either fails to parse or
 * fails schema validation, and both surface as "failed".
 */
export async function runNestedObjectGeneration<T>({
  model,
  schema,
  system,
  prompt,
  temperature,
  numCtx,
  timeoutMs,
  abortSignal,
  guard,
  label,
}: NestedObjectGenerationArgs<T>): Promise<NestedObjectGenerationResult<T>> {
  if (guard.running) return { status: "busy" };
  guard.running = true;

  const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (abortSignal) signals.push(abortSignal);

  try {
    const { object } = await generateObject({
      model,
      schema,
      system,
      prompt,
      temperature,
      abortSignal: AbortSignal.any(signals),
      // Same recovery the non-agent call sites use: some OpenRouter models
      // ignore the JSON response format and answer with a ```json fence.
      experimental_repairText: repairJsonText,
      providerOptions: {
        ollama: { options: { num_ctx: numCtx } },
        openai: { strictJsonSchema: false },
      },
    });
    return { status: "ok", object };
  } catch (error) {
    console.error(`[agent-chat] ${label} object generation failed:`, error);
    return { status: "failed" };
  } finally {
    guard.running = false;
  }
}
