"use server";

import { generateObject } from "ai";

import db from "@/lib/db";
import { handleError } from "@/lib/utils";
import { getCurrentUser } from "@/utils/user.utils";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { getModel } from "@/lib/ai/providers";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";
import { TEMPERATURES, TEXT_LIMITS } from "@/lib/ai/config";
import {
  InterviewQuestionsSchema,
  type InterviewQuestions,
  type ProcessResearch,
} from "@/models/ai.schemas";
import { defaultUserSettings } from "@/models/userSettings.model";
import { AiProvider } from "@/models/ai.model";
import { getJobDetails } from "@/actions/job.actions";
import { getResumeById, getDefaultResumeId } from "@/actions/profile.actions";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { getCompanyContext } from "@/lib/research/company";
import { getInterviewProcess } from "@/lib/research/process";
import { NO_COMPANY_CONTEXT } from "@/lib/research/config";

export interface InterviewPrepData {
  questions: InterviewQuestions;
  process: ProcessResearch | null;
  contextSources: string[];
  generatedAt: Date;
}

/** Read a persisted interview prep for a job, or null if none exists. */
export const getInterviewPrep = async (
  jobId: string,
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const row = await db.interviewPrep.findFirst({
      where: { jobId, userId: user.id },
    });
    if (!row) return { success: true, data: null };

    return {
      success: true,
      data: {
        questions: JSON.parse(row.questions) as InterviewQuestions,
        process: row.process
          ? (JSON.parse(row.process) as ProcessResearch)
          : null,
        generatedAt: row.generatedAt,
      },
    };
  } catch (error) {
    return handleError(error, "Failed to load interview preparation.");
  }
};

/**
 * Generate interview preparation for a job.
 *
 * Degradation contract (see the plan's three-class model):
 *  - Class 1 (technical/gaps/cvBreaks/behavioural/candidateQuestions) is the
 *    trunk and the only mandatory LLM call. If it fails the whole action fails.
 *  - Class 2 (culture/situation) is a branch: any failure resets companyContext
 *    to the NONE sentinel, and the system prompt then forces empty Class-2
 *    arrays. It can never break Class 1.
 *  - Class 3 (process) is a flag-gated branch: any failure — wall, timeout, no
 *    Tavily key, flag off — yields process = null. It can never break Class 1/2.
 *
 * One checkRateLimit for the whole action even though it may fan out to three
 * LLM calls (company research, questions, process research).
 */
export const generateInterviewPrep = async (
  jobId: string,
  resumeIdArg?: string,
): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const rl = checkRateLimit(user.id);
    if (!rl.allowed) {
      return {
        success: false,
        message: "Rate limit exceeded. Please try again shortly.",
      };
    }

    // Resolve AI + research settings.
    const settingsRow = await db.userSettings.findUnique({
      where: { userId: user.id },
    });
    const parsed = settingsRow ? JSON.parse(settingsRow.settings) : {};
    const ai = { ...defaultUserSettings.ai, ...(parsed.ai ?? {}) };
    const research = {
      ...defaultUserSettings.research,
      ...(parsed.research ?? {}),
    };

    // Inputs. Failure here is a hard fail — there is nothing to prepare on.
    const resumeId = resumeIdArg ?? (await getDefaultResumeId());
    if (!resumeId) {
      return {
        success: false,
        message: "No resume selected. Set a default resume first.",
      };
    }

    const [resumeRes, jobRes] = await Promise.all([
      getResumeById(resumeId),
      getJobDetails(jobId),
    ]);
    const resume = resumeRes?.data;
    const job = jobRes?.job;
    if (!resume || !job) {
      return { success: false, message: "Missing resume or job." };
    }

    const [resumePre, jobPre] = await Promise.all([
      preprocessResume(resume),
      preprocessJob(job),
    ]);
    if (!resumePre.success || !jobPre.success) {
      return { success: false, message: "Failed to prepare resume or job text." };
    }

    const isOllama = ai.provider === AiProvider.OLLAMA;
    const limits = isOllama ? TEXT_LIMITS.OLLAMA : TEXT_LIMITS.CLOUD;
    const resumeText = resumePre.data.normalizedText.slice(0, limits.RESUME);
    const jobDescription = jobPre.data.normalizedText.slice(0, limits.JOB);

    const model = await getModel(ai.provider, ai.model || "llama3.2", user.id);
    const company = { id: job.Company.id, label: job.Company.label };

    // ── Class 2 enrichment (branch: failure ⇒ sentinel) ──────────────────────
    let companyContext = NO_COMPANY_CONTEXT;
    let contextSources: string[] = [];
    const { context, sources } = await getCompanyContext(
      user.id,
      company,
      model,
    );
    if (context) {
      companyContext = JSON.stringify(context);
      contextSources = sources;
    }

    // ── Class 1 + Class 2 questions (trunk: the only mandatory LLM call) ──────
    const { system, prompt } = await resolvePromptPair(
      "interview-prep",
      user.id,
      { resumeText, jobDescription, companyContext }, // companyContext ALWAYS passed
    );
    const { object: questions } = await generateObject({
      model,
      schema: InterviewQuestionsSchema,
      system,
      prompt,
      temperature: TEMPERATURES.ANALYSIS,
    });

    // ── Class 3 process research (flag-gated branch: failure ⇒ null) ─────────
    let process: ProcessResearch | null = null;
    if (research.enableProcessResearch) {
      process = await getInterviewProcess(user.id, company, model);
    }

    const saved = await db.interviewPrep.upsert({
      where: { jobId },
      update: {
        questions: JSON.stringify(questions),
        process: process ? JSON.stringify(process) : null,
        generatedAt: new Date(),
      },
      create: {
        jobId,
        userId: user.id,
        questions: JSON.stringify(questions),
        process: process ? JSON.stringify(process) : null,
      },
    });

    return {
      success: true,
      data: {
        questions,
        process,
        contextSources,
        generatedAt: saved.generatedAt,
      } satisfies InterviewPrepData,
    };
  } catch (error) {
    return handleError(error, "Failed to generate interview preparation.");
  }
};
