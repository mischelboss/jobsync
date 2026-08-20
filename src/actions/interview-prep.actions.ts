"use server";

import { generateObject } from "ai";
import { repairJsonText } from "@/lib/ai/repair-json";

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
