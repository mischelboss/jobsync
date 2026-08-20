import { buildPrepareInterviewTool } from "@/lib/agent/tools/prepareInterview";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { generateInterviewPrepCore } from "@/lib/interviewPrep/generate";

vi.mock("@/lib/agent/jobLookup", () => ({ resolveJobForAgent: vi.fn() }));
vi.mock("@/lib/agent/resumeLookup", () => ({ resolveResumeForAgent: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing", () => ({ preprocessResume: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing-job", () => ({ preprocessJob: vi.fn() }));
vi.mock("@/lib/interviewPrep/generate", () => ({
  generateInterviewPrepCore: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  default: { userSettings: { findUnique: vi.fn() } },
}));

import db from "@/lib/db";

const findJob = resolveJobForAgent as unknown as ReturnType<typeof vi.fn>;
const findResume = resolveResumeForAgent as unknown as ReturnType<typeof vi.fn>;
const preResume = preprocessResume as unknown as ReturnType<typeof vi.fn>;
const preJob = preprocessJob as unknown as ReturnType<typeof vi.fn>;
const core = generateInterviewPrepCore as unknown as ReturnType<typeof vi.fn>;
const settings = db.userSettings.findUnique as unknown as ReturnType<typeof vi.fn>;

const RESUME_TEXT = "R".repeat(5_000);
const JOB_TEXT = "Job Title: Senior Backend Engineer\nCompany: Northwind Cloud";

const QUESTIONS = {
  technical: [{ question: "How would you shard this?", rationale: "JD names scale", answerScaffold: "Describe partition keys." }],
  gaps: [],
  cvBreaks: [],
  behavioural: [],
  candidateQuestions: [],
  cultureValues: [],
  currentSituation: [],
};

const ctx = (overrides: Record<string, unknown> = {}) => ({
  userId: "session-user",
  pageJobId: "job-1",
  model: { id: "fake-model" } as any,
  provider: "ollama",
  modelName: "qwen3.5:9b",
  guard: { running: false },
  ...overrides,
});

const execute = (agentTool: any, input: any) =>
  agentTool.execute(input, { toolCallId: "call-1", messages: [] });

describe("prepare_interview agent tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findJob.mockResolvedValue({
      status: "ok",
      job: {
        id: "job-1",
        resumeId: "r9",
        JobTitle: { label: "Senior Backend Engineer" },
        Company: { id: "c1", label: "Northwind Cloud" },
      },
    });
    findResume.mockResolvedValue({
      status: "ok",
      resume: { id: "r9", title: "Senior Engineer Resume" },
      source: "page",
      ambiguousTitle: false,
    });
    preResume.mockResolvedValue({
      success: true,
      data: { normalizedText: RESUME_TEXT, metadata: {}, isValid: true },
    });
    preJob.mockResolvedValue({
      success: true,
      data: { normalizedText: JOB_TEXT, metadata: {}, isValid: true },
    });
    settings.mockResolvedValue(null);
    core.mockResolvedValue({
      status: "ok",
      questions: QUESTIONS,
      process: null,
      contextSources: ["https://northwind.test/about"],
      generatedAt: new Date("2026-08-20T10:00:00.000Z"),
    });
  });

  it("returns the grouped questions on the happy path", async () => {
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("ok");
    expect(out.jobTitle).toBe("Senior Backend Engineer");
    expect(out.company).toBe("Northwind Cloud");
    expect(out.resumeTitle).toBe("Senior Engineer Resume");
    expect(out.questions).toEqual(QUESTIONS);
    expect(out.generatedAt).toBe("2026-08-20T10:00:00.000Z");
  });

  // The id must come from server-held page context, never from the model.
  it("scopes the job lookup to the session user and the page's job", async () => {
    await execute(buildPrepareInterviewTool(ctx()), { resumeTitle: "anything" });
    expect(findJob).toHaveBeenCalledWith("session-user", "job-1");
  });

  it("passes the preprocessed texts and the job's company to the core", async () => {
    await execute(buildPrepareInterviewTool(ctx()), {});
    expect(core).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "session-user",
        jobId: "job-1",
        resumeText: RESUME_TEXT,
        jobDescription: JOB_TEXT,
        company: { id: "c1", label: "Northwind Cloud" },
      }),
    );
  });

  // Class-3 research costs a second round of fetching, so the user's setting
  // decides — not the model.
  it("reads enableProcessResearch from the user's settings", async () => {
    settings.mockResolvedValue({
      settings: JSON.stringify({ research: { enableProcessResearch: true } }),
    });
    await execute(buildPrepareInterviewTool(ctx()), {});
    expect(core).toHaveBeenCalledWith(
      expect.objectContaining({ enableProcessResearch: true }),
    );
  });

  it("reports no_job when the user is not on a job page", async () => {
    findJob.mockResolvedValue({ status: "no_job" });
    const out = await execute(buildPrepareInterviewTool(ctx({ pageJobId: undefined })), {});
    expect(out).toEqual({ status: "no_job" });
    expect(core).not.toHaveBeenCalled();
  });

  it("asks which resume to use when the lookup is ambiguous", async () => {
    findResume.mockResolvedValue({
      status: "needs_selection",
      resumes: [{ id: "r1", title: "A" }, { id: "r2", title: "B" }],
    });
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("needs_selection");
    expect(core).not.toHaveBeenCalled();
  });

  // The research runs on the company, so a job without one cannot proceed.
  it("reports unreadable when the job has no company", async () => {
    findJob.mockResolvedValue({
      status: "ok",
      job: { id: "job-1", JobTitle: { label: "Senior Backend Engineer" }, Company: null },
    });
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("unreadable");
    expect(out.what).toBe("job");
    expect(core).not.toHaveBeenCalled();
  });

  it("reports unreadable when the job description is too thin", async () => {
    preJob.mockResolvedValue({ success: false });
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("unreadable");
    expect(out.what).toBe("job");
    expect(core).not.toHaveBeenCalled();
  });

  it("surfaces a busy guard as a retryable failure", async () => {
    core.mockResolvedValue({ status: "busy" });
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("generation_failed");
    expect(out.reason).toMatch(/already running/i);
  });

  it("reports nothing saved when the generation fails", async () => {
    core.mockResolvedValue({ status: "failed" });
    const out = await execute(buildPrepareInterviewTool(ctx()), {});
    expect(out.status).toBe("generation_failed");
    expect(out.reason).toMatch(/nothing was saved/i);
  });
});
