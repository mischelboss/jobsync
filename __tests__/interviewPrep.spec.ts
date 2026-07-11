import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { PROMPT_REGISTRY_BY_ID } from "@/lib/ai/prompts/registry";
import { extractPlaceholders } from "@/lib/ai/prompts/interpolate";
import { fetchPageText, followJobLink } from "@/lib/scraper/email/follow";

// resolveApiKey is the only external dependency of tavilySearch we need to steer.
vi.mock("@/lib/api-key-resolver", () => ({
  resolveApiKey: vi.fn(),
}));
import { resolveApiKey } from "@/lib/api-key-resolver";
import { tavilySearch } from "@/lib/research/search";

const mockedResolveApiKey = vi.mocked(resolveApiKey);

describe("interview-prep prompt invariants", () => {
  it("interview-prep user template requires exactly the three variables the action always passes", () => {
    const entry = PROMPT_REGISTRY_BY_ID["interview-prep.user"];
    expect([...entry.requiredPlaceholders].sort()).toEqual([
      "companyContext",
      "jobDescription",
      "resumeText",
    ]);
  });

  it("always renders {{companyContext}} so the sentinel path cannot leak a raw placeholder", () => {
    // The action passes companyContext unconditionally (sentinel "NONE" when
    // absent); the template must therefore reference it.
    const entry = PROMPT_REGISTRY_BY_ID["interview-prep.user"];
    expect(extractPlaceholders(entry.defaultText)).toContain("companyContext");
  });

  it("registers the two research extraction prompts as structured output", () => {
    expect(PROMPT_REGISTRY_BY_ID["company-research.user"].structuredOutput).toBe(
      true,
    );
    expect(
      PROMPT_REGISTRY_BY_ID["interview-process.user"].structuredOutput,
    ).toBe(true);
  });
});

describe("tavilySearch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockedResolveApiKey.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns [] and never calls fetch when no key is configured", async () => {
    mockedResolveApiKey.mockResolvedValue(undefined);
    const hits = await tavilySearch("user-1", "acme culture");
    expect(hits).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] on a non-ok response", async () => {
    mockedResolveApiKey.mockResolvedValue("tvly-key");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await tavilySearch("user-1", "acme")).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockedResolveApiKey.mockResolvedValue("tvly-key");
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await tavilySearch("user-1", "acme")).toEqual([]);
  });

  it("maps results and drops hits without a url", async () => {
    mockedResolveApiKey.mockResolvedValue("tvly-key");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { title: "About", url: "https://acme.com/about", content: "We build" },
          { title: "No URL", content: "orphan" },
        ],
      }),
    });
    const hits = await tavilySearch("user-1", "acme");
    expect(hits).toEqual([
      { title: "About", url: "https://acme.com/about", snippet: "We build" },
    ]);
  });
});

describe("fetchPageText / followJobLink parity", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("followJobLink skips walled hosts without fetching", async () => {
    expect(await followJobLink("https://www.glassdoor.com/jobs/123")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetchPageText with allowWalled attempts a walled host", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      text: async () => `<html><body>${"content ".repeat(100)}</body></html>`,
    });
    const text = await fetchPageText("https://www.glassdoor.com/interview", {
      allowWalled: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(text).toContain("content");
  });

  it("still degrades to null when a walled page returns a challenge marker", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      text: async () => `<html><body>cf-challenge ${"x ".repeat(300)}</body></html>`,
    });
    const text = await fetchPageText("https://www.glassdoor.com/interview", {
      allowWalled: true,
    });
    expect(text).toBeNull();
  });

  it("returns null on an invalid url without throwing", async () => {
    expect(await fetchPageText("not a url", { allowWalled: true })).toBeNull();
  });
});
