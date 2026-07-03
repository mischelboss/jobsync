/**
 * PDF Text Extraction
 * Extracts raw text from an uploaded PDF buffer for downstream LLM processing
 */

// Import the inner lib directly instead of the package root: pdf-parse's
// index.js runs a debug-mode branch (reads a test fixture off disk) whenever
// `module.parent` is unset, which happens under ESM interop / Next.js bundling.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { validateText } from "./text-processing";

const MIN_CHAR_COUNT = 30;

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  error?: { code: string; message: string };
}

/**
 * Extracts text from a PDF buffer.
 * Returns a clear error when the PDF contains no extractable text
 * (e.g. a scanned/image-only PDF).
 */
export const extractTextFromPdf = async (
  buffer: Buffer,
): Promise<PdfExtractionResult> => {
  let rawText: string;
  try {
    const parsed = await pdfParse(buffer);
    rawText = parsed.text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      text: "",
      error: {
        code: "PDF_PARSE_ERROR",
        message: `Could not read this PDF file: ${message}`,
      },
    };
  }

  const validation = validateText(
    rawText,
    MIN_CHAR_COUNT,
    50000,
    "CV",
  );

  if (!validation.isValid) {
    const isEmpty = validation.error?.code === "NO_CONTENT" || validation.error?.code === "TOO_SHORT";
    return {
      success: false,
      text: "",
      error: {
        code: isEmpty ? "NO_EXTRACTABLE_TEXT" : validation.error!.code,
        message: isEmpty
          ? "No text could be extracted from this PDF. It looks like a scanned or image-based PDF, which isn't supported yet — please upload a text-based PDF."
          : validation.error!.message,
      },
    };
  }

  return { success: true, text: rawText.trim() };
};
