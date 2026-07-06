import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportJobPdf } from "@/components/myjobs/ImportJobPdf";
import { getUserSettings } from "@/actions/userSettings.actions";
import { toast } from "@/components/ui/use-toast";

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

const importData = {
  prefill: {
    title: "t1",
    company: "c1",
    location: "l1",
    type: "FT",
    salaryRange: "7",
    jobDescription: "<p>Great job</p>",
    jobUrl: "https://example.com/job",
  },
  jobTitle: { id: "t1", label: "Engineer", value: "engineer" },
  company: { id: "c1", label: "Acme", value: "acme" },
  location: { id: "l1", label: "Berlin", value: "berlin" },
};

describe("ImportJobPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserSettings as any).mockResolvedValue({
      success: true,
      data: { settings: { ai: { provider: "ollama", model: "llama3.2" } } },
    });
  });

  const selectPdf = async () => {
    const file = new File(["%PDF-1.4"], "job.pdf", {
      type: "application/pdf",
    });
    const input = screen.getByTestId("import-job-pdf-input");
    await userEvent.upload(input, file);
  };

  it("uploads the PDF and passes the import result to onImported", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: importData }),
    }) as any;
    const onImported = vi.fn();

    render(<ImportJobPdf onImported={onImported} />);
    await selectPdf();

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith(importData);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/job/import",
      expect.objectContaining({ method: "POST" }),
    );
    const body = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(JSON.parse(body.get("model") as string)).toEqual({
      provider: "ollama",
      model: "llama3.2",
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows an error toast when the import fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Only PDF files are supported" }),
    }) as any;
    const onImported = vi.fn();

    render(<ImportJobPdf onImported={onImported} />);
    await selectPdf();

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Only PDF files are supported",
        }),
      );
    });
    expect(onImported).not.toHaveBeenCalled();
  });
});
