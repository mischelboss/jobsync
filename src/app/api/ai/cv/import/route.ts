import "server-only";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/providers";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { extractTextFromPdf } from "@/lib/ai/tools/pdf-extraction";
import { CvImportSchema, AIUnavailableError } from "@/lib/ai";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";
import { AiModel } from "@/models/ai.model";

/**
 * CV Import Endpoint
 * Extracts text from an uploaded PDF CV and asks the LLM to pull out
 * contact info + a professional summary, used to prefill the resume forms.
 */
export const POST = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${Math.ceil(
          rateLimit.resetIn / 1000,
        )} seconds.`,
      },
      { status: 429 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const selectedModelRaw = formData.get("selectedModel") as string | null;

  if (!file || !selectedModelRaw) {
    return NextResponse.json(
      { error: "CV file and model selection required" },
      { status: 400 },
    );
  }

  const selectedModel = JSON.parse(selectedModelRaw) as AiModel;

  const isPdf =
    file.type === "application/pdf" ||
    file.name?.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json(
      { error: "Only PDF files are supported for CV import." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractTextFromPdf(buffer);
    if (!extraction.success) {
      return NextResponse.json(
        { error: extraction.error!.message, code: extraction.error!.code },
        { status: 400 },
      );
    }

    const model = await getModel(
      selectedModel.provider,
      selectedModel.model || "llama3.2",
      userId,
    );

    const { system, prompt } = await resolvePromptPair("cv-import", userId, {
      cvText: extraction.text,
    });

    const { object } = await generateObject({
      model,
      schema: CvImportSchema,
      system,
      prompt,
      temperature: 0.2,
    });

    return NextResponse.json({ success: true, data: object });
  } catch (error) {
    console.error("CV import error:", error);

    if (error instanceof AIUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message =
      error instanceof Error ? error.message : "AI request failed";

    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        {
          error: `Cannot connect to ${selectedModel.provider} service. Please ensure the service is running.`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
