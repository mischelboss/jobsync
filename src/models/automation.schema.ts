import { z } from "zod";
import { APP_CONSTANTS } from "@/lib/constants";

export const JobBoardSchema = z.enum(["jsearch", "greenhouse", "arbeitsagentur"]);

export const SourceTypeSchema = z.enum(["jobboard", "email"]);

export const EmailFilterTypeSchema = z.enum(["label", "sender", "subject"]);

export const AutomationStatusSchema = z.enum(["active", "paused"]);

export const AutomationRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "completed_with_errors",
  "blocked",
  "rate_limited",
]);

export const DiscoveryStatusSchema = z.enum([
  "new",
  "below_threshold",
  "accepted",
  "dismissed",
]);

export const GreenhouseCompanySchema = z.object({
  name: z.string().min(1).max(200),
  token: z.string().min(1).max(80),
});

export const GreenhouseSourceConfigSchema = z.object({
  companies: z
    .array(GreenhouseCompanySchema)
    .max(APP_CONSTANTS.MAX_GREENHOUSE_COMPANIES),
  targetTitles: z.array(z.string().min(1).max(100)).optional(),
  keywords: z.array(z.string().min(1).max(100)).optional(),
  locations: z.array(z.string().min(1).max(100)).optional(),
  strictLocation: z.boolean().optional(),
  topK: z.number().int().min(1).max(APP_CONSTANTS.GREENHOUSE_LISTING_CAP).optional(),
  saveUnanalyzed: z.boolean().optional(),
});

export const SourceConfigSchema = z.object({
  greenhouse: GreenhouseSourceConfigSchema.optional(),
});

export const CreateAutomationSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    sourceType: SourceTypeSchema,
    jobBoard: JobBoardSchema.optional(),
    keywords: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    sourceConfig: SourceConfigSchema.optional(),
    emailFilterType: EmailFilterTypeSchema.optional(),
    emailFilterValue: z.string().max(320).optional(),
    followLinks: z.boolean().optional(),
    resumeId: z.string().uuid("Invalid resume"),
    matchThreshold: z.number().min(0).max(100),
    scheduleHour: z.number().min(0).max(23),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "email") {
      if (!data.emailFilterType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emailFilterType"],
          message: "Filter type is required",
        });
      }
      if (!data.emailFilterValue || data.emailFilterValue.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emailFilterValue"],
          message: "Filter value is required",
        });
      }
      return;
    }

    // sourceType === "jobboard"
    if (!data.jobBoard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobBoard"],
        message: "Job board is required",
      });
      return;
    }

    if (data.jobBoard === "jsearch" || data.jobBoard === "arbeitsagentur") {
      if (!data.keywords || data.keywords.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["keywords"],
          message: "Keywords are required",
        });
      }
      if (!data.location || data.location.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["location"],
          message: "Location is required",
        });
      }
    }

    if (data.jobBoard === "greenhouse") {
      const companies = data.sourceConfig?.greenhouse?.companies ?? [];
      if (companies.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceConfig", "greenhouse", "companies"],
          message: "Select at least one company",
        });
      }
    }
  });

export const UpdateAutomationSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    sourceType: SourceTypeSchema.optional(),
    jobBoard: JobBoardSchema.optional(),
    keywords: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    sourceConfig: SourceConfigSchema.optional(),
    emailFilterType: EmailFilterTypeSchema.optional(),
    emailFilterValue: z.string().max(320).optional(),
    followLinks: z.boolean().optional(),
    resumeId: z.string().uuid("Invalid resume").optional(),
    matchThreshold: z.number().min(0).max(100).optional(),
    scheduleHour: z.number().min(0).max(23).optional(),
  })
  .superRefine((data, ctx) => {
    // Email automations don't use the board fields; the wizard carries a
    // placeholder jobBoard ("greenhouse") that must not trigger board validation.
    if (data.sourceType === "email") return;

    if (data.jobBoard === "greenhouse") {
      const companies = data.sourceConfig?.greenhouse?.companies ?? [];
      if (companies.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceConfig", "greenhouse", "companies"],
          message: "Select at least one company",
        });
      }
    }
  });

export type CreateAutomationInput = z.infer<typeof CreateAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationSchema>;
export type SourceConfigInput = z.infer<typeof SourceConfigSchema>;
export type GreenhouseSourceConfigInput = z.infer<
  typeof GreenhouseSourceConfigSchema
>;
