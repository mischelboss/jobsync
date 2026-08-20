import { describe, it, expect } from "vitest";
import { extractJsonText, repairJsonText } from "@/lib/ai/repair-json";

describe("extractJsonText", () => {
  it("unwraps a ```json fence", () => {
    expect(extractJsonText('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("unwraps a bare ``` fence with no language tag", () => {
    expect(extractJsonText('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("ignores prose on either side of the fence", () => {
    const text = 'Here you go:\n\n```json\n{"a":1}\n```\n\nHope that helps!';
    expect(extractJsonText(text)).toBe('{"a":1}');
  });

  it("recovers a fence the model opened but never closed", () => {
    expect(extractJsonText('```json\n{"a":1}')).toBe('{"a":1}');
  });

  it("strips a preamble before a bare object", () => {
    expect(extractJsonText('Here is the JSON: {"a":1}')).toBe('{"a":1}');
  });

  it("extracts a top-level array", () => {
    expect(extractJsonText('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  // The interview-prep answers quote code, so braces inside strings are normal.
  it("does not stop at a brace inside a string value", () => {
    const json = '{"answer":"use a map like {k: v} here","b":2}';
    expect(extractJsonText(`prose ${json}`)).toBe(json);
  });

  it("does not stop at an escaped quote inside a string value", () => {
    const json = '{"answer":"they said \\"hi\\" and left","b":2}';
    expect(extractJsonText(`\`\`\`json\n${json}\n\`\`\``)).toBe(json);
  });

  it("returns null when there is no JSON at all", () => {
    expect(extractJsonText("I cannot help with that.")).toBeNull();
    expect(extractJsonText("")).toBeNull();
  });
});

describe("repairJsonText", () => {
  it("repairs fenced JSON", async () => {
    expect(await repairJsonText({ text: '```json\n{"a":1}\n```' })).toBe(
      '{"a":1}',
    );
  });

  // Returning null lets the SDK surface its own error rather than masking it.
  it("declines when the text is already bare JSON", async () => {
    expect(await repairJsonText({ text: '{"a":1}' })).toBeNull();
  });

  it("declines when there is nothing to extract", async () => {
    expect(await repairJsonText({ text: "no json here" })).toBeNull();
  });
});
