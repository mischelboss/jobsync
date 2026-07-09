import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: { promptOverride: { findMany: vi.fn() } },
}));

import db from "@/lib/db";
import {
  resolvePromptPair,
  resolvePromptTemplates,
} from "@/lib/ai/prompts/resolve";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "@/lib/ai/prompts/job-match";

const findMany = db.promptOverride.findMany as unknown as ReturnType<
  typeof vi.fn
>;

const RESUME = "Senior engineer, 10 years";
const JOB = "Looking for a senior engineer";

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("resolvePromptPair with no overrides", () => {
  it("returns byte-identical prompts to the hardcoded defaults", async () => {
    const { system, prompt } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(system).toBe(JOB_MATCH_SYSTEM_PROMPT);
    expect(prompt).toBe(buildJobMatchPrompt(RESUME, JOB));
  });

  it("skips the database entirely when there is no userId", async () => {
    const { prompt } = await resolvePromptPair("job-match", undefined, {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(findMany).not.toHaveBeenCalled();
    expect(prompt).toBe(buildJobMatchPrompt(RESUME, JOB));
  });

  it("scopes the override lookup to the user and the feature's two prompts", async () => {
    await resolvePromptTemplates("job-match", "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          promptId: { in: ["job-match.system", "job-match.user"] },
        },
      }),
    );
  });
});

describe("interpolation safety", () => {
  it("inserts values containing $& and $1 verbatim", async () => {
    const nasty = "Costs $1,000 and $& more";
    const { prompt } = await resolvePromptPair("job-match", undefined, {
      resumeText: nasty,
      jobDescription: JOB,
    });

    expect(prompt).toContain(nasty);
  });

  it("does not re-expand a placeholder that appears inside a value", async () => {
    const { prompt } = await resolvePromptPair("job-match", undefined, {
      resumeText: "{{jobDescription}}",
      jobDescription: JOB,
    });

    // The literal from the resume survives; only the template's own placeholder
    // was replaced.
    expect(prompt).toContain("RESUME:\n{{jobDescription}}");
  });

  it("leaves placeholders with no matching variable in place", async () => {
    const { prompt } = await resolvePromptPair("job-match", undefined, {
      resumeText: RESUME,
    });

    expect(prompt).toContain("{{jobDescription}}");
  });
});

describe("overrides", () => {
  it("appends appendText after the default, separated by a blank line", async () => {
    findMany.mockResolvedValue([
      { promptId: "job-match.system", overrideText: null, appendText: "Reply in German." },
    ]);

    const { system } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(system).toBe(`${JOB_MATCH_SYSTEM_PROMPT}\n\nReply in German.`);
  });

  it("replaces the default with overrideText", async () => {
    findMany.mockResolvedValue([
      { promptId: "job-match.system", overrideText: "You are terse.", appendText: null },
    ]);

    const { system } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(system).toBe("You are terse.");
  });

  it("combines overrideText and appendText", async () => {
    findMany.mockResolvedValue([
      {
        promptId: "job-match.system",
        overrideText: "You are terse.",
        appendText: "Reply in German.",
      },
    ]);

    const { system } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(system).toBe("You are terse.\n\nReply in German.");
  });

  it("interpolates placeholders inside an override template", async () => {
    findMany.mockResolvedValue([
      {
        promptId: "job-match.user",
        overrideText: "CV: {{resumeText}} / JD: {{jobDescription}}",
        appendText: null,
      },
    ]);

    const { prompt } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(prompt).toBe(`CV: ${RESUME} / JD: ${JOB}`);
  });
});

describe("resilience", () => {
  it("falls back to the default when an override drops a required placeholder", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockResolvedValue([
      {
        promptId: "job-match.user",
        // {{jobDescription}} is gone, so the model would never see the job.
        overrideText: "Only the resume: {{resumeText}}",
        appendText: "Be brief.",
      },
    ]);

    const { prompt } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(prompt).toBe(`${buildJobMatchPrompt(RESUME, JOB)}\n\nBe brief.`);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to defaults when the override lookup throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("no such table: PromptOverride"));

    const { system, prompt } = await resolvePromptPair("job-match", "user-1", {
      resumeText: RESUME,
      jobDescription: JOB,
    });

    expect(system).toBe(JOB_MATCH_SYSTEM_PROMPT);
    expect(prompt).toBe(buildJobMatchPrompt(RESUME, JOB));
    warn.mockRestore();
  });
});
