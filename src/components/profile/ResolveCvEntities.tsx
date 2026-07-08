"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { toast } from "../ui/use-toast";
import { Company, JobLocation, JobTitle } from "@/models/job.model";
import { Resume, SectionType } from "@/models/profile.model";
import { CvEducationImport, CvWorkExperienceImport } from "@/models/ai.schemas";
import { getAllCompanies, addCompany } from "@/actions/company.actions";
import { getAllJobTitles, createJobTitle } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { createLocation } from "@/actions/job.actions";
import { addExperience, addEducation } from "@/actions/profile.actions";
import { findBestMatches, normalizeForMatch, MatchCandidate } from "@/lib/matching/similarity";

interface ResolveCvEntitiesProps {
  resume: Resume;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workExperiences: CvWorkExperienceImport[];
  educations: CvEducationImport[];
  onDone: () => void;
}

type EntityKind = "company" | "jobTitle" | "location";
type Resolution = { mode: "existing" | "create"; existingId?: string };
type NamedEntity = { id: string; label: string };

const AUTO_SELECT_THRESHOLD = 0.75;
const CANDIDATE_THRESHOLD = 0.55;

const resolutionKey = (kind: EntityKind, name: string) =>
  `${kind}:${normalizeForMatch(name)}`;

const uniqueNames = (names: (string | null | undefined)[]): string[] => {
  const seen = new Map<string, string>();
  for (const raw of names) {
    if (!raw) continue;
    const key = normalizeForMatch(raw);
    if (key && !seen.has(key)) seen.set(key, raw);
  }
  return Array.from(seen.values());
};

const parseCvDate = (value: string | null): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  let iso = trimmed;
  if (/^\d{4}$/.test(trimmed)) iso = `${trimmed}-01-01`;
  else if (/^\d{4}-\d{2}$/.test(trimmed)) iso = `${trimmed}-01`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const formatRange = (start: string | null, end: string | null, ongoing: boolean) =>
  `${start || "?"} – ${ongoing ? "Present" : end || "?"}`;

function EntityResolutionSection({
  title,
  kind,
  names,
  candidatesByName,
  resolutions,
  onChange,
}: {
  title: string;
  kind: EntityKind;
  names: string[];
  candidatesByName: Record<string, MatchCandidate<NamedEntity>[]>;
  resolutions: Record<string, Resolution>;
  onChange: (key: string, resolution: Resolution) => void;
}) {
  if (names.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="font-medium mb-2">{title}</h4>
      <div className="space-y-3">
        {names.map((name) => {
          const key = resolutionKey(kind, name);
          const candidates = candidatesByName[name] ?? [];
          const resolution = resolutions[key];
          const radioValue =
            resolution?.mode === "existing" ? `existing:${resolution.existingId}` : "create";

          return (
            <div key={key} className="border rounded-md p-3">
              <div className="text-sm text-muted-foreground mb-2">
                Detected: <span className="font-medium text-foreground">&quot;{name}&quot;</span>
              </div>
              <RadioGroup
                value={radioValue}
                onValueChange={(val) =>
                  onChange(
                    key,
                    val === "create"
                      ? { mode: "create" }
                      : { mode: "existing", existingId: val.replace("existing:", "") },
                  )
                }
              >
                {candidates.map((c) => (
                  <div key={c.item.id} className="flex items-center gap-2">
                    <RadioGroupItem value={`existing:${c.item.id}`} id={`${key}-${c.item.id}`} />
                    <Label
                      htmlFor={`${key}-${c.item.id}`}
                      className="flex items-center gap-2 font-normal cursor-pointer"
                    >
                      Use existing: <span className="font-medium">{c.item.label}</span>
                      <Badge variant="secondary">{Math.round(c.score * 100)}% match</Badge>
                    </Label>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="create" id={`${key}-create`} />
                  <Label htmlFor={`${key}-create`} className="font-normal cursor-pointer">
                    Create new: <span className="font-medium">{name}</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResolveCvEntities({
  resume,
  open,
  onOpenChange,
  workExperiences,
  educations,
  onDone,
}: ResolveCvEntitiesProps) {
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [locations, setLocations] = useState<JobLocation[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [includedExperience, setIncludedExperience] = useState<boolean[]>([]);
  const [includedEducation, setIncludedEducation] = useState<boolean[]>([]);
  const [isSaving, startSaving] = useTransition();

  const companyNames = useMemo(
    () => uniqueNames(workExperiences.map((w) => w.company)),
    [workExperiences],
  );
  const jobTitleNames = useMemo(
    () => uniqueNames(workExperiences.map((w) => w.jobTitle)),
    [workExperiences],
  );
  const locationNames = useMemo(
    () =>
      uniqueNames([
        ...workExperiences.map((w) => w.location),
        ...educations.map((e) => e.location),
      ]),
    [workExperiences, educations],
  );

  const experienceValidity = useMemo(
    () =>
      workExperiences.map((w) => ({
        hasStart: !!parseCvDate(w.startDate),
        hasLocation: !!w.location,
      })),
    [workExperiences],
  );
  const educationValidity = useMemo(
    () =>
      educations.map((e) => ({
        hasStart: !!parseCvDate(e.startDate),
        hasLocation: !!e.location,
      })),
    [educations],
  );

  useEffect(() => {
    if (!open) return;
    setResolutions({});
    setIsLoadingEntities(true);
    Promise.all([getAllCompanies(), getAllJobTitles(), getAllJobLocations()])
      .then(([_companies, _titles, _locations]) => {
        setCompanies(Array.isArray(_companies) ? _companies : []);
        setJobTitles(Array.isArray(_titles) ? _titles : []);
        setLocations(Array.isArray(_locations) ? _locations : []);
      })
      .finally(() => setIsLoadingEntities(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setIncludedExperience(experienceValidity.map((v) => v.hasStart && v.hasLocation));
    setIncludedEducation(educationValidity.map((v) => v.hasStart && v.hasLocation));
  }, [open, experienceValidity, educationValidity]);

  const companyCandidates = useMemo(
    () =>
      Object.fromEntries(
        companyNames.map((n) => [
          n,
          findBestMatches(n, companies, (c) => c.label, {
            threshold: CANDIDATE_THRESHOLD,
          }),
        ]),
      ),
    [companyNames, companies],
  );
  const jobTitleCandidates = useMemo(
    () =>
      Object.fromEntries(
        jobTitleNames.map((n) => [
          n,
          findBestMatches(n, jobTitles, (t) => t.label, {
            threshold: CANDIDATE_THRESHOLD,
          }),
        ]),
      ),
    [jobTitleNames, jobTitles],
  );
  const locationCandidates = useMemo(
    () =>
      Object.fromEntries(
        locationNames.map((n) => [
          n,
          findBestMatches(n, locations, (l) => l.label, {
            threshold: CANDIDATE_THRESHOLD,
          }),
        ]),
      ),
    [locationNames, locations],
  );

  useEffect(() => {
    if (!open || isLoadingEntities) return;
    setResolutions((prev) => {
      const next = { ...prev };
      const applyDefaults = (
        names: string[],
        kind: EntityKind,
        candidatesByName: Record<string, MatchCandidate<NamedEntity>[]>,
      ) => {
        for (const name of names) {
          const key = resolutionKey(kind, name);
          if (next[key]) continue;
          const best = candidatesByName[name]?.[0];
          next[key] =
            best && best.score >= AUTO_SELECT_THRESHOLD
              ? { mode: "existing", existingId: best.item.id }
              : { mode: "create" };
        }
      };
      applyDefaults(companyNames, "company", companyCandidates);
      applyDefaults(jobTitleNames, "jobTitle", jobTitleCandidates);
      applyDefaults(locationNames, "location", locationCandidates);
      return next;
    });
  }, [
    open,
    isLoadingEntities,
    companyNames,
    jobTitleNames,
    locationNames,
    companyCandidates,
    jobTitleCandidates,
    locationCandidates,
  ]);

  const setResolution = (key: string, resolution: Resolution) =>
    setResolutions((prev) => ({ ...prev, [key]: resolution }));

  const resolveOrCreateCompany = async (name: string): Promise<string> => {
    const normalized = normalizeForMatch(name);
    const exact = companies.find((c) => normalizeForMatch(c.label) === normalized);
    if (exact) return exact.id;
    const result = await addCompany({ company: name });
    if (result?.success && result.data?.id) return result.data.id;
    throw new Error(result?.message || `Failed to create company "${name}"`);
  };

  const resolveOrCreateJobTitle = async (name: string): Promise<string> => {
    const result = await createJobTitle(name);
    if (result?.id) return result.id;
    throw new Error(result?.message || `Failed to create job title "${name}"`);
  };

  const resolveOrCreateLocation = async (name: string): Promise<string> => {
    const result = await createLocation(name);
    if (result?.success && result.data?.id) return result.data.id;
    throw new Error(result?.message || `Failed to create location "${name}"`);
  };

  const handleConfirm = () => {
    startSaving(async () => {
      const errors: string[] = [];

      const resolveAll = async (
        names: string[],
        kind: EntityKind,
        resolver: (name: string) => Promise<string>,
      ) => {
        const map = new Map<string, string>();
        for (const name of names) {
          const key = resolutionKey(kind, name);
          const resolution = resolutions[key];
          try {
            const id =
              resolution?.mode === "existing" && resolution.existingId
                ? resolution.existingId
                : await resolver(name);
            map.set(key, id);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : `Failed to resolve "${name}"`);
          }
        }
        return map;
      };

      const [companyIdByKey, jobTitleIdByKey, locationIdByKey] = await Promise.all([
        resolveAll(companyNames, "company", resolveOrCreateCompany),
        resolveAll(jobTitleNames, "jobTitle", resolveOrCreateJobTitle),
        resolveAll(locationNames, "location", resolveOrCreateLocation),
      ]);

      let experienceSectionId = resume.ResumeSections?.find(
        (s) => s.sectionType === SectionType.EXPERIENCE,
      )?.id;
      let educationSectionId = resume.ResumeSections?.find(
        (s) => s.sectionType === SectionType.EDUCATION,
      )?.id;

      let experienceCount = 0;
      for (let i = 0; i < workExperiences.length; i++) {
        if (!includedExperience[i]) continue;
        const w = workExperiences[i];
        const companyId = companyIdByKey.get(resolutionKey("company", w.company));
        const titleId = jobTitleIdByKey.get(resolutionKey("jobTitle", w.jobTitle));
        const locationId = w.location
          ? locationIdByKey.get(resolutionKey("location", w.location))
          : undefined;
        const startDate = parseCvDate(w.startDate);
        if (!companyId || !titleId || !locationId || !startDate) {
          errors.push(`Skipped "${w.jobTitle}" at "${w.company}" — missing required data.`);
          continue;
        }

        const res = await addExperience({
          resumeId: resume.id,
          sectionId: experienceSectionId,
          sectionTitle: "Experience",
          title: titleId,
          company: companyId,
          location: locationId,
          jobDescription: w.description?.trim() || "No description provided.",
          startDate,
          endDate: w.isCurrent ? null : parseCvDate(w.endDate),
          currentJob: w.isCurrent,
        });
        if (res?.success) {
          experienceCount++;
          experienceSectionId = experienceSectionId ?? res.data?.id;
        } else {
          errors.push(res?.message || `Failed to add experience at "${w.company}".`);
        }
      }

      let educationCount = 0;
      for (let i = 0; i < educations.length; i++) {
        if (!includedEducation[i]) continue;
        const e = educations[i];
        const locationId = e.location
          ? locationIdByKey.get(resolutionKey("location", e.location))
          : undefined;
        const startDate = parseCvDate(e.startDate);
        if (!locationId || !startDate) {
          errors.push(`Skipped "${e.institution}" — missing required data.`);
          continue;
        }

        const res = await addEducation({
          resumeId: resume.id,
          sectionId: educationSectionId,
          sectionTitle: "Education",
          institution: e.institution,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          location: locationId,
          description: e.description,
          startDate,
          endDate: e.isCompleted ? parseCvDate(e.endDate) : null,
          degreeCompleted: e.isCompleted,
        });
        if (res?.success) {
          educationCount++;
          educationSectionId = educationSectionId ?? res.data?.id;
        } else {
          errors.push(res?.message || `Failed to add education at "${e.institution}".`);
        }
      }

      if (experienceCount || educationCount) {
        toast({
          variant: "success",
          description: `Added ${experienceCount} work experience${experienceCount === 1 ? "" : "s"} and ${educationCount} education entr${educationCount === 1 ? "y" : "ies"}.`,
        });
      }
      if (errors.length) {
        toast({
          variant: "destructive",
          title: errors.length === 1 ? "One entry needs attention" : `${errors.length} entries need attention`,
          description: errors.slice(0, 3).join(" "),
        });
      }
      if (!experienceCount && !educationCount && !errors.length) {
        toast({ description: "No entries selected to import." });
      }

      onDone();
    });
  };

  const totalIncluded =
    includedExperience.filter(Boolean).length + includedEducation.filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full md:h-[85%] lg:max-h-screen md:max-w-2xl overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>Review Work Experience & Education</DialogTitle>
          <DialogDescription>
            We matched extracted companies, job titles, and locations against your
            existing records. Confirm each one below before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {isLoadingEntities ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-5 w-5 spinner" />
          </div>
        ) : (
          <>
            <EntityResolutionSection
              title="Job Titles"
              kind="jobTitle"
              names={jobTitleNames}
              candidatesByName={jobTitleCandidates}
              resolutions={resolutions}
              onChange={setResolution}
            />
            <EntityResolutionSection
              title="Companies"
              kind="company"
              names={companyNames}
              candidatesByName={companyCandidates}
              resolutions={resolutions}
              onChange={setResolution}
            />
            <EntityResolutionSection
              title="Locations"
              kind="location"
              names={locationNames}
              candidatesByName={locationCandidates}
              resolutions={resolutions}
              onChange={setResolution}
            />

            {workExperiences.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Work Experience Entries</h4>
                <div className="space-y-2">
                  {workExperiences.map((w, i) => (
                    <div key={i} className="flex items-start justify-between border rounded-md p-3 gap-3">
                      <div className="text-sm">
                        <div className="font-medium">
                          {w.jobTitle} @ {w.company}
                        </div>
                        <div className="text-muted-foreground">
                          {formatRange(w.startDate, w.endDate, w.isCurrent)}
                          {w.location ? ` · ${w.location}` : ""}
                        </div>
                        {!experienceValidity[i]?.hasLocation && (
                          <div className="text-destructive text-xs mt-1">
                            Missing location — add this entry manually after import.
                          </div>
                        )}
                        {!experienceValidity[i]?.hasStart && (
                          <div className="text-destructive text-xs mt-1">
                            Missing/unparseable start date — add this entry manually after import.
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={!!includedExperience[i]}
                        disabled={!experienceValidity[i]?.hasStart || !experienceValidity[i]?.hasLocation}
                        onCheckedChange={(checked) =>
                          setIncludedExperience((prev) => {
                            const next = [...prev];
                            next[i] = checked;
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {educations.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Education Entries</h4>
                <div className="space-y-2">
                  {educations.map((e, i) => (
                    <div key={i} className="flex items-start justify-between border rounded-md p-3 gap-3">
                      <div className="text-sm">
                        <div className="font-medium">
                          {e.degree}, {e.fieldOfStudy} @ {e.institution}
                        </div>
                        <div className="text-muted-foreground">
                          {formatRange(e.startDate, e.endDate, !e.isCompleted)}
                          {e.location ? ` · ${e.location}` : ""}
                        </div>
                        {!educationValidity[i]?.hasLocation && (
                          <div className="text-destructive text-xs mt-1">
                            Missing location — add this entry manually after import.
                          </div>
                        )}
                        {!educationValidity[i]?.hasStart && (
                          <div className="text-destructive text-xs mt-1">
                            Missing/unparseable start date — add this entry manually after import.
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={!!includedEducation[i]}
                        disabled={!educationValidity[i]?.hasStart || !educationValidity[i]?.hasLocation}
                        onCheckedChange={(checked) =>
                          setIncludedEducation((prev) => {
                            const next = [...prev];
                            next[i] = checked;
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || isLoadingEntities || totalIncluded === 0}
          >
            Confirm & Import ({totalIncluded})
            {isSaving && <Loader className="h-4 w-4 shrink-0 spinner" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResolveCvEntities;
