"use server";

import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { handleError } from "@/lib/utils";
import {
  PROMPT_REGISTRY_BY_ID,
  validateOverrideText,
} from "@/lib/ai/prompts/registry";
import {
  promptOverrideSaveSchema,
  type PromptOverrideClientResponse,
  type PromptOverrideSaveInput,
} from "@/models/prompt.schema";

/** Whitespace-only input means "not set", so the prompt falls back to its default. */
function normalize(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

export async function getPromptOverrides(): Promise<{
  success: boolean;
  data?: PromptOverrideClientResponse[];
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const overrides = await db.promptOverride.findMany({
      where: { userId: user.id },
      select: { promptId: true, overrideText: true, appendText: true },
    });

    return { success: true, data: overrides };
  } catch (error) {
    return handleError(error, "Failed to fetch prompt overrides") as {
      success: boolean;
      message: string;
    };
  }
}

export async function upsertPromptOverride(
  input: PromptOverrideSaveInput,
): Promise<{
  success: boolean;
  data?: PromptOverrideClientResponse;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const parsed = promptOverrideSaveSchema.parse(input);

    const entry = PROMPT_REGISTRY_BY_ID[parsed.promptId];
    if (!entry) {
      return { success: false, message: "Unknown prompt" };
    }

    const overrideText = normalize(parsed.overrideText);
    const appendText = normalize(parsed.appendText);

    if (overrideText) {
      const problem = validateOverrideText(entry, overrideText);
      if (problem) return { success: false, message: problem };
    }

    // Absence of a row is how the data model spells "pure default".
    if (!overrideText && !appendText) {
      await db.promptOverride.deleteMany({
        where: { userId: user.id, promptId: parsed.promptId },
      });
      return {
        success: true,
        data: { promptId: parsed.promptId, overrideText: null, appendText: null },
      };
    }

    const saved = await db.promptOverride.upsert({
      where: {
        userId_promptId: { userId: user.id, promptId: parsed.promptId },
      },
      create: {
        userId: user.id,
        promptId: parsed.promptId,
        overrideText,
        appendText,
      },
      update: { overrideText, appendText },
      select: { promptId: true, overrideText: true, appendText: true },
    });

    return { success: true, data: saved };
  } catch (error) {
    return handleError(error, "Failed to save prompt") as {
      success: boolean;
      message: string;
    };
  }
}

/** Drops both the override and the append text, returning the prompt to its default. */
export async function resetPromptOverride(promptId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    await db.promptOverride.deleteMany({
      where: { userId: user.id, promptId },
    });

    return { success: true };
  } catch (error) {
    return handleError(error, "Failed to reset prompt") as {
      success: boolean;
      message: string;
    };
  }
}
