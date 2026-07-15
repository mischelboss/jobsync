import { z } from "zod";

const MAX_PROMPT_CHARS = 20_000;

export const promptOverrideSaveSchema = z.object({
  promptId: z.string().min(1, "Prompt is required"),
  overrideText: z.string().max(MAX_PROMPT_CHARS).nullish(),
  appendText: z.string().max(MAX_PROMPT_CHARS).nullish(),
});

export type PromptOverrideSaveInput = z.infer<typeof promptOverrideSaveSchema>;

export interface PromptOverrideClientResponse {
  promptId: string;
  overrideText: string | null;
  appendText: string | null;
}
