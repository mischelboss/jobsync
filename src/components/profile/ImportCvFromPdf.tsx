"use client";

import { useState } from "react";
import { FileUp, Loader, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { toast } from "../ui/use-toast";
import { ContactInfo, Resume, ResumeSection, SectionType } from "@/models/profile.model";
import { CvImportResponse } from "@/models/ai.schemas";
import { AiModel, defaultModel } from "@/models/ai.model";
import { getUserSettings } from "@/actions/userSettings.actions";
import { checkOllamaConnection } from "@/utils/ai.utils";
import AddContactInfo from "./AddContactInfo";
import AddResumeSummary from "./AddResumeSummary";
import ResolveCvEntities from "./ResolveCvEntities";

interface ImportCvFromPdfProps {
  resume: Resume;
}

type ContactPrefill = Pick<
  CvImportResponse,
  "firstName" | "lastName" | "headline" | "email" | "phone" | "address"
>;

const hasText = (value: string | null | undefined) => !!value?.trim();

function ImportCvFromPdf({ resume }: ImportCvFromPdfProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState<AiModel>(defaultModel);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string>("");

  const [step, setStep] = useState<"contact" | "summary" | "entities" | null>(null);
  const [contactInfoToEdit, setContactInfoToEdit] = useState<ContactInfo | null>(null);
  const [contactPrefillData, setContactPrefillData] = useState<ContactPrefill | null>(null);
  const [summaryToEdit, setSummaryToEdit] = useState<ResumeSection | null>(null);
  const [summaryPrefillData, setSummaryPrefillData] = useState<{ sectionTitle?: string; content: string } | null>(null);
  const [extractedExperiences, setExtractedExperiences] = useState<CvImportResponse["workExperiences"]>([]);
  const [extractedEducations, setExtractedEducations] = useState<CvImportResponse["educations"]>([]);

  const existingSummarySection = resume?.ResumeSections?.find(
    (section) => section.sectionType === SectionType.SUMMARY,
  );

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const result = await getUserSettings();
      if (result.success && result.data?.settings?.ai) {
        const aiSettings = result.data.settings.ai;
        const model: AiModel = {
          provider: aiSettings.provider || defaultModel.provider,
          model: aiSettings.model,
        };
        setSelectedModel(model);
        if (model.provider === "ollama") {
          setOllamaConnected(null);
          setConnectionError("");
          const status = await checkOllamaConnection(model.provider);
          setOllamaConnected(status.isConnected);
          if (!status.isConnected) {
            setConnectionError(status.error || "Ollama is not reachable.");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching AI settings:", error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const onOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setFile(null);
      fetchSettings();
    }
  };

  const resetImportState = () => {
    setStep(null);
    setContactInfoToEdit(null);
    setContactPrefillData(null);
    setSummaryToEdit(null);
    setSummaryPrefillData(null);
    setExtractedExperiences([]);
    setExtractedEducations([]);
  };

  const applyExtraction = (data: CvImportResponse) => {
    const anyContactField =
      hasText(data.firstName) ||
      hasText(data.lastName) ||
      hasText(data.headline) ||
      hasText(data.email) ||
      hasText(data.phone) ||
      hasText(data.address);

    let hasSummaryPayload = false;

    if (hasText(data.summary)) {
      if (existingSummarySection) {
        setSummaryToEdit({
          ...existingSummarySection,
          summary: {
            ...existingSummarySection.summary,
            content: data.summary!,
          },
        });
      } else {
        setSummaryPrefillData({ sectionTitle: "Summary", content: data.summary! });
      }
      hasSummaryPayload = true;
    }

    const workExperiences = data.workExperiences ?? [];
    const educations = data.educations ?? [];
    setExtractedExperiences(workExperiences);
    setExtractedEducations(educations);
    const hasEntities = workExperiences.length > 0 || educations.length > 0;

    if (anyContactField) {
      if (resume.ContactInfo) {
        setContactInfoToEdit({
          ...resume.ContactInfo,
          firstName: data.firstName || resume.ContactInfo.firstName,
          lastName: data.lastName || resume.ContactInfo.lastName,
          headline: data.headline || resume.ContactInfo.headline,
          email: data.email || resume.ContactInfo.email,
          phone: data.phone || resume.ContactInfo.phone,
          address: data.address || resume.ContactInfo.address,
        });
      } else {
        setContactPrefillData({
          firstName: data.firstName,
          lastName: data.lastName,
          headline: data.headline,
          email: data.email,
          phone: data.phone,
          address: data.address,
        });
      }
      setStep("contact");
    } else if (hasSummaryPayload) {
      setStep("summary");
    } else if (hasEntities) {
      setStep("entities");
    } else {
      toast({
        variant: "destructive",
        title: "Nothing found",
        description: "The AI couldn't extract any contact info, summary, experience, or education from this CV.",
      });
    }
  };

  const advanceToEntitiesOrDone = () => {
    if (extractedExperiences.length > 0 || extractedEducations.length > 0) {
      setStep("entities");
    } else {
      resetImportState();
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Only PDF files are supported.",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("selectedModel", JSON.stringify(selectedModel));

      const res = await fetch("/api/ai/cv/import", {
        method: "POST",
        body: formData,
      });
      const response = await res.json();

      if (!res.ok || !response.success) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: response.error || "Failed to import CV.",
        });
        return;
      }

      setDialogOpen(false);
      applyExtraction(response.data as CvImportResponse);
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Failed to import CV. Please try again.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleContactDialogChange = (open: boolean) => {
    if (open) return;
    if (summaryToEdit || summaryPrefillData) {
      setStep("summary");
    } else {
      advanceToEntitiesOrDone();
    }
  };

  const handleSummaryDialogChange = (open: boolean) => {
    if (open) return;
    advanceToEntitiesOrDone();
  };

  const handleEntitiesOpenChange = (open: boolean) => {
    if (!open) resetImportState();
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 cursor-pointer">
            <FileUp className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Import from CV
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from CV (PDF)</DialogTitle>
            <DialogDescription>
              Upload a text-based PDF resume. We&apos;ll extract your contact
              info, summary, work experience, and education and let you
              review everything below — nothing is saved until you confirm.
            </DialogDescription>
          </DialogHeader>

          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {selectedModel.provider === "ollama" && (
            <>
              {ollamaConnected === true && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Ollama is connected</span>
                </div>
              )}
              {ollamaConnected === false && (
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{connectionError}</span>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExtract}
              disabled={
                !file ||
                isExtracting ||
                isLoadingSettings ||
                (selectedModel.provider === "ollama" && ollamaConnected === false)
              }
            >
              Extract & Prefill
              {isExtracting && <Loader className="h-4 w-4 shrink-0 spinner" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddContactInfo
        resumeId={resume?.id}
        dialogOpen={step === "contact"}
        setDialogOpen={handleContactDialogChange}
        contactInfoToEdit={contactInfoToEdit}
        prefillData={contactPrefillData}
      />
      <AddResumeSummary
        resumeId={resume?.id}
        dialogOpen={step === "summary"}
        setDialogOpen={handleSummaryDialogChange}
        summaryToEdit={summaryToEdit}
        prefillData={summaryPrefillData}
      />
      <ResolveCvEntities
        resume={resume}
        open={step === "entities"}
        onOpenChange={handleEntitiesOpenChange}
        workExperiences={extractedExperiences}
        educations={extractedEducations}
        onDone={resetImportState}
      />
    </>
  );
}

export default ImportCvFromPdf;
