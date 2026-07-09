import { generateObject } from "ai";
import {
  getModel,
  EmailAlertSchema,
  EMAIL_ALERT_SYSTEM_PROMPT,
  buildEmailAlertPrompt,
  type EmailAlertJob,
} from "@/lib/ai";
import type { AiProvider } from "@/models/ai.model";
import { flattenHtml } from "../greenhouse";
import type { ScraperError } from "../types";
import type { AlertEmail } from "./index";

// LLM cannot swallow an entire multi-job newsletter verbatim without cost/latency
// blowing up; alert emails are text-light so this cap is generous.
const MAX_EMAIL_CHARS = 24_000;

export type ExtractResult =
  | { success: true; jobs: EmailAlertJob[] }
  | { success: false; error: ScraperError };

// Turns one alert email's content into an array of jobs via a single LLM call.
// Prefers the plaintext part; falls back to a tag-stripped HTML body.
export async function extractJobsFromEmail(
  email: AlertEmail,
  provider: AiProvider,
  modelName: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ExtractResult> {
  const raw = email.text?.trim() || flattenHtml(email.html ?? "");
  const emailText = raw.slice(0, MAX_EMAIL_CHARS);

  if (!emailText) {
    return { success: true, jobs: [] };
  }

  try {
    const model = await getModel(provider, modelName, userId);
    const { object } = await generateObject({
      model,
      schema: EmailAlertSchema,
      system: EMAIL_ALERT_SYSTEM_PROMPT,
      prompt: buildEmailAlertPrompt(emailText),
      temperature: 0.2,
      abortSignal: signal,
    });

    // Keep only listings with a usable title — the LLM occasionally emits a
    // stub for a "see more jobs" row despite the prompt.
    const jobs = object.jobs.filter(
      (j) => j.title && j.title.trim().length >= 2,
    );
    return { success: true, jobs };
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return { success: false, error: { type: "parse", message: "aborted" } };
    }
    const message =
      error instanceof Error ? error.message : "Email extraction failed";
    return { success: false, error: { type: "parse", message } };
  }
}
