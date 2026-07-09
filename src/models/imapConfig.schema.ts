import { z } from "zod";

// Shared credential fields. `password` is required on create and optional on
// update (empty = keep the stored one).
export const ImapCredentialsSchema = z.object({
  host: z.string().min(1, "Host is required").max(255),
  port: z.number().int().min(1).max(65535).default(993),
  username: z.string().min(1, "Username is required").max(320),
  useTls: z.boolean().default(true),
});

export const UpsertImapConfigSchema = ImapCredentialsSchema.extend({
  // Optional on update so the user can change host/port without re-entering the
  // app password; required (non-empty) on first create is enforced in the action.
  password: z.string().max(512).optional(),
});

export const TestImapConnectionSchema = ImapCredentialsSchema.extend({
  // When testing an already-saved config the client sends no password and the
  // action falls back to the stored one.
  password: z.string().max(512).optional(),
});

export type UpsertImapConfigInput = z.infer<typeof UpsertImapConfigSchema>;
export type TestImapConnectionInput = z.infer<typeof TestImapConnectionSchema>;
