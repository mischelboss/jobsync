import { describe, it, expect } from "vitest";
import {
  PROMPT_REGISTRY,
  PROMPT_REGISTRY_BY_ID,
  PROMPT_FEATURES,
  validateOverrideText,
} from "@/lib/ai/prompts/registry";
import { extractPlaceholders } from "@/lib/ai/prompts/interpolate";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  JOB_MATCH_USER_TEMPLATE,
} from "@/lib/ai/prompts/job-match";

describe("prompt registry", () => {
  it("has a unique id per entry", () => {
    const ids = PROMPT_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers a system and a user prompt for every feature", () => {
    expect(PROMPT_REGISTRY).toHaveLength(PROMPT_FEATURES.length * 2);
    for (const feature of PROMPT_FEATURES) {
      expect(PROMPT_REGISTRY_BY_ID[feature.systemId]?.type).toBe("system");
      expect(PROMPT_REGISTRY_BY_ID[feature.userId]?.type).toBe("template");
    }
  });

  it("carries the real prompt text, not a copy that can drift", () => {
    expect(PROMPT_REGISTRY_BY_ID["job-match.system"].defaultText).toBe(
      JOB_MATCH_SYSTEM_PROMPT,
    );
    expect(PROMPT_REGISTRY_BY_ID["job-match.user"].defaultText).toBe(
      JOB_MATCH_USER_TEMPLATE,
    );
  });

  it("declares exactly the placeholders its default text uses", () => {
    for (const entry of PROMPT_REGISTRY) {
      expect([...entry.requiredPlaceholders].sort()).toEqual(
        extractPlaceholders(entry.defaultText).sort(),
      );
    }
  });

  it("gives every template prompt at least one placeholder", () => {
    for (const entry of PROMPT_REGISTRY) {
      if (entry.type === "template") {
        expect(entry.requiredPlaceholders.length).toBeGreaterThan(0);
      } else {
        expect(entry.requiredPlaceholders).toEqual([]);
      }
    }
  });

  it("marks the structured-output features", () => {
    const structured = PROMPT_FEATURES.filter((f) => f.structuredOutput).map(
      (f) => f.feature,
    );
    expect(structured.sort()).toEqual([
      "company-research",
      "cv-import",
      "email-alert",
      "interview-prep",
      "interview-process",
      "job-import",
      "resume-import",
    ]);
  });
});

describe("validateOverrideText", () => {
  const template = PROMPT_REGISTRY_BY_ID["job-match.user"];
  const system = PROMPT_REGISTRY_BY_ID["job-match.system"];

  it("accepts an override that keeps every required placeholder", () => {
    expect(
      validateOverrideText(template, "{{resumeText}} vs {{jobDescription}}"),
    ).toBeNull();
  });

  it("rejects an override that drops a required placeholder", () => {
    const error = validateOverrideText(template, "Only {{resumeText}}");
    expect(error).toContain("{{jobDescription}}");
  });

  it("reports the missing placeholder when one is mistyped", () => {
    // A typo drops a required placeholder and adds an unknown one. Naming the
    // missing one is the more actionable half of the message.
    const error = validateOverrideText(
      template,
      "{{resumetext}} vs {{jobDescription}}",
    );
    expect(error).toContain("Missing required placeholder");
    expect(error).toContain("{{resumeText}}");
  });

  it("rejects an extra placeholder the prompt has no variable for", () => {
    const error = validateOverrideText(
      template,
      "{{resumeText}} vs {{jobDescription}} at {{salary}}",
    );
    expect(error).toContain("Unknown placeholder");
    expect(error).toContain("{{salary}}");
  });

  it("accepts any text for a system prompt", () => {
    expect(validateOverrideText(system, "You are a pirate.")).toBeNull();
  });

  it("rejects placeholders in a system prompt, which takes no variables", () => {
    expect(validateOverrideText(system, "Read {{resumeText}}")).toContain(
      "Unknown placeholder",
    );
  });
});
