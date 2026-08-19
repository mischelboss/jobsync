/**
 * Recovery for models that answer a structured-output request with prose-wrapped
 * JSON instead of a bare object.
 *
 * generateObject asks the provider for JSON, but that request is only honoured
 * when the provider *and* the specific model support a structured response
 * format. OpenRouter silently falls back to plain text generation for models
 * that don't, and many of those models then wrap their JSON in a ```json fence
 * — which is valid model behaviour and invalid JSON, so parsing fails with
 * AI_NoObjectGeneratedError and the whole feature dies on an otherwise perfect
 * response.
 *
 * Passed as `experimental_repairText`, this runs ONLY after the SDK's own parse
 * has already failed, so it can never alter a well-formed response.
 */

/** Opening ``` optionally followed by a language tag, on its own line. */
const OPENING_FENCE = /^\s*```[a-zA-Z0-9_-]*\s*\n/;
const CLOSING_FENCE = /\n\s*```\s*$/;

/**
 * Pull the JSON value out of `text`, or return null if there is nothing that
 * plausibly parses. Handles a fenced block, prose on either side of one, and a
 * bare object or array preceded by a preamble ("Here is the JSON:").
 */
export function extractJsonText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // A fenced block anywhere in the response is the strongest signal, so prefer
  // it over brace-matching, which would otherwise stop at a brace in the prose.
  const fenced = trimmed.match(/```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n\s*```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner) return inner;
  }

  // An unterminated fence: the model opened one and hit the token limit.
  if (OPENING_FENCE.test(trimmed)) {
    const opened = trimmed.replace(OPENING_FENCE, "").replace(CLOSING_FENCE, "");
    if (opened.trim()) return opened.trim();
  }

  // No fence: take the outermost balanced object or array, skipping any
  // preamble. Brace counting is string-aware so a `}` inside a value — common
  // in these prompts, whose answers quote code — doesn't end the scan early.
  const start = trimmed.search(/[{[]/);
  if (start === -1) return null;

  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * `experimental_repairText` for generateObject/streamObject. Returns the
 * repaired text, or null to let the SDK report its original parse failure.
 */
export async function repairJsonText({
  text,
}: {
  text: string;
}): Promise<string | null> {
  const extracted = extractJsonText(text);
  if (extracted === null || extracted === text.trim()) return null;
  return extracted;
}
