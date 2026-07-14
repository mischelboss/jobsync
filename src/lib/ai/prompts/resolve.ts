import "server-only";

import db from "@/lib/db";
import { interpolate, extractPlaceholders } from "./interpolate";
import {
  PROMPT_REGISTRY_BY_ID,
  systemPromptId,
  userPromptId,
  type PromptEntry,
  type PromptFeature,
} from "./registry";

/**
 * Runtime resolution of a registered prompt: the user's override text (or the
 * default), with placeholders filled in and their append text tacked on.
 *
 * Never throws. A user with no PromptOverride row — and any failure to read one,
 * including the table not existing yet — resolves to the untouched default, so
 * every LLM feature behaves exactly as it did before the Prompt Library existed.
 *
 * Not exported from `prompts/index.ts` or `@/lib/ai`: this module is server-only
 * and those barrels are reachable from code that must stay bundle-safe.
 */

interface OverrideRow {
  promptId: string;
  overrideText: string | null;
  appendText: string | null;
}

async function loadOverrides(
  userId: string | undefined,
  promptIds: string[],
): Promise<Map<string, OverrideRow>> {
  if (!userId) return new Map();

  try {
    const rows = await db.promptOverride.findMany({
      where: { userId, promptId: { in: promptIds } },
      select: { promptId: true, overrideText: true, appendText: true },
    });
    return new Map(rows.map((row) => [row.promptId, row]));
  } catch (error) {
    // Treat any read failure as "no overrides" rather than taking down the
    // LLM call: the code may be running ahead of the migration, or outside a
    // context where the client can connect.
    console.warn("Failed to load prompt overrides, using defaults", error);
    return new Map();
  }
}

/**
 * Apply one override on top of its registry default. Returns text that may still
 * contain placeholders; the caller interpolates.
 */
function applyOverride(
  entry: PromptEntry,
  override: OverrideRow | undefined,
): string {
  let text = entry.defaultText;

  if (override?.overrideText) {
    const present = new Set(extractPlaceholders(override.overrideText));
    const missing = entry.requiredPlaceholders.filter((p) => !present.has(p));

    if (missing.length > 0) {
      // upsertPromptOverride rejects this, so a row like it predates a registry
      // change. Dropping context silently would be worse than ignoring the override.
      console.warn(
        `Prompt override "${entry.id}" is missing required placeholder(s) ${missing
          .map((p) => `{{${p}}}`)
          .join(", ")}; falling back to the default text.`,
      );
    } else {
      text = override.overrideText;
    }
  }

  if (override?.appendText) {
    text = `${text}\n\n${override.appendText}`;
  }

  return text;
}

/**
 * The system prompt (fully resolved) and the user template (override + append
 * applied, placeholders still intact). Use this when the same prompt is reused
 * across many LLM calls, so the override is read once.
 */
export async function resolvePromptTemplates(
  feature: PromptFeature,
  userId: string | undefined,
): Promise<{ system: string; promptTemplate: string }> {
  const systemEntry = PROMPT_REGISTRY_BY_ID[systemPromptId(feature)];
  const userEntry = PROMPT_REGISTRY_BY_ID[userPromptId(feature)];

  const overrides = await loadOverrides(userId, [systemEntry.id, userEntry.id]);

  return {
    system: applyOverride(systemEntry, overrides.get(systemEntry.id)),
    promptTemplate: applyOverride(userEntry, overrides.get(userEntry.id)),
  };
}

/** Both prompts for one feature, ready to hand to the AI SDK. */
export async function resolvePromptPair(
  feature: PromptFeature,
  userId: string | undefined,
  variables: Record<string, string>,
): Promise<{ system: string; prompt: string }> {
  const { system, promptTemplate } = await resolvePromptTemplates(
    feature,
    userId,
  );

  return {
    system: interpolate(system, variables),
    prompt: interpolate(promptTemplate, variables),
  };
}
