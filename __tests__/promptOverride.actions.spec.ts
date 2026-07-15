import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    promptOverride: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import {
  getPromptOverrides,
  upsertPromptOverride,
  resetPromptOverride,
} from "@/actions/prompt.actions";
import { JOB_MATCH_USER_TEMPLATE } from "@/lib/ai/prompts/job-match";

const mockUser = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const promptOverride = db.promptOverride as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.mockResolvedValue({ id: "user-1", name: "A", email: "a@b.c" });
});

describe("authentication", () => {
  it("refuses every action without a session", async () => {
    mockUser.mockResolvedValue(null);

    expect(await getPromptOverrides()).toEqual({
      success: false,
      message: "Not authenticated",
    });
    expect(
      await upsertPromptOverride({ promptId: "job-match.system", appendText: "x" }),
    ).toEqual({ success: false, message: "Not authenticated" });
    expect(await resetPromptOverride("job-match.system")).toEqual({
      success: false,
      message: "Not authenticated",
    });
    expect(promptOverride.upsert).not.toHaveBeenCalled();
  });
});

describe("getPromptOverrides", () => {
  it("only reads the current user's rows", async () => {
    promptOverride.findMany.mockResolvedValue([]);
    await getPromptOverrides();

    expect(promptOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });
});

describe("upsertPromptOverride", () => {
  it("rejects a promptId that is not in the registry", async () => {
    const result = await upsertPromptOverride({
      promptId: "does-not-exist",
      appendText: "x",
    });

    expect(result).toEqual({ success: false, message: "Unknown prompt" });
    expect(promptOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an override missing a required placeholder", async () => {
    const result = await upsertPromptOverride({
      promptId: "job-match.user",
      overrideText: "Only {{resumeText}}",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("{{jobDescription}}");
    expect(promptOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an override with an unknown placeholder", async () => {
    const result = await upsertPromptOverride({
      promptId: "job-match.user",
      overrideText: "{{resumeText}} {{jobDescription}} {{salary}}",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown placeholder");
  });

  it("saves a valid override scoped to the user", async () => {
    promptOverride.upsert.mockResolvedValue({
      promptId: "job-match.user",
      overrideText: JOB_MATCH_USER_TEMPLATE,
      appendText: null,
    });

    const result = await upsertPromptOverride({
      promptId: "job-match.user",
      overrideText: JOB_MATCH_USER_TEMPLATE,
    });

    expect(result.success).toBe(true);
    expect(promptOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_promptId: { userId: "user-1", promptId: "job-match.user" },
        },
      }),
    );
  });

  it("deletes the row when both fields are blank, so the default applies", async () => {
    promptOverride.deleteMany.mockResolvedValue({ count: 1 });

    const result = await upsertPromptOverride({
      promptId: "job-match.system",
      overrideText: "   ",
      appendText: "",
    });

    expect(result.success).toBe(true);
    expect(promptOverride.upsert).not.toHaveBeenCalled();
    expect(promptOverride.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", promptId: "job-match.system" },
    });
  });

  it("stores whitespace-only fields as null", async () => {
    promptOverride.upsert.mockResolvedValue({
      promptId: "job-match.system",
      overrideText: null,
      appendText: "Be brief.",
    });

    await upsertPromptOverride({
      promptId: "job-match.system",
      overrideText: "  \n ",
      appendText: "  Be brief.  ",
    });

    expect(promptOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { overrideText: null, appendText: "Be brief." },
      }),
    );
  });
});

describe("resetPromptOverride", () => {
  it("deletes the row for this user and prompt", async () => {
    promptOverride.deleteMany.mockResolvedValue({ count: 1 });

    const result = await resetPromptOverride("cv-import.system");

    expect(result).toEqual({ success: true });
    expect(promptOverride.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", promptId: "cv-import.system" },
    });
  });
});
