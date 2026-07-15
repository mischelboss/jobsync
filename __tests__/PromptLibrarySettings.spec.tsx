import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/actions/prompt.actions", () => ({
  getPromptOverrides: vi.fn(),
  upsertPromptOverride: vi.fn(),
  resetPromptOverride: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

import PromptLibrarySettings from "@/components/settings/PromptLibrarySettings";
import {
  getPromptOverrides,
  upsertPromptOverride,
} from "@/actions/prompt.actions";
import { JOB_MATCH_USER_TEMPLATE } from "@/lib/ai/prompts/job-match";

const mockGet = getPromptOverrides as unknown as ReturnType<typeof vi.fn>;
const mockUpsert = upsertPromptOverride as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ success: true, data: [] });
  mockUpsert.mockResolvedValue({ success: true, data: {} });
});

/** Opens the Job Match feature and its user-prompt Advanced editor. */
async function openJobMatchOverride() {
  const user = userEvent.setup();
  render(<PromptLibrarySettings />);

  await user.click(await screen.findByText("Job Match"));

  // Two editors are mounted: [0] system prompt, [1] user prompt.
  const advanced = await screen.findAllByRole("button", {
    name: /Advanced: replace default text/,
  });
  await user.click(advanced[1]);

  return screen.findByLabelText("User prompt override text");
}

describe("PromptLibrarySettings", () => {
  it("lists every registered prompt feature", async () => {
    render(<PromptLibrarySettings />);

    expect(await screen.findByText("Job Match")).toBeInTheDocument();
    expect(screen.getByText("Resume Review")).toBeInTheDocument();
    expect(screen.getByText("Automation Job Match")).toBeInTheDocument();
    expect(screen.getByText("Resume Import")).toBeInTheDocument();
    expect(screen.getByText("CV Import")).toBeInTheDocument();
    expect(screen.getByText("Job Import")).toBeInTheDocument();
    expect(screen.getByText("Email Alert Extraction")).toBeInTheDocument();
  });

  it("seeds the Advanced editor with the shipped default text", async () => {
    const overrideBox = await openJobMatchOverride();
    expect(overrideBox).toHaveValue(JOB_MATCH_USER_TEMPLATE);
  });

  it("blocks saving a template override that drops a required placeholder", async () => {
    const overrideBox = await openJobMatchOverride();

    // Drop {{jobDescription}} — the job posting would never reach the model.
    fireEvent.change(overrideBox, {
      target: { value: "Only the resume: {{resumeText}}" },
    });

    expect(
      await screen.findByText(/Missing required placeholder/),
    ).toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    await waitFor(() => expect(saveButtons[1]).toBeDisabled());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("allows saving an override that keeps its placeholders", async () => {
    const overrideBox = await openJobMatchOverride();

    fireEvent.change(overrideBox, {
      target: { value: "CV {{resumeText}} JD {{jobDescription}}" },
    });

    expect(
      screen.queryByText(/Missing required placeholder/),
    ).not.toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    await waitFor(() => expect(saveButtons[1]).toBeEnabled());

    fireEvent.click(saveButtons[1]);
    await waitFor(() =>
      expect(mockUpsert).toHaveBeenCalledWith({
        promptId: "job-match.user",
        overrideText: "CV {{resumeText}} JD {{jobDescription}}",
        appendText: null,
      }),
    );
  });
});
