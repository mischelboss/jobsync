"use server";

import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { handleError } from "@/lib/utils";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  UpsertImapConfigSchema,
  TestImapConnectionSchema,
  type UpsertImapConfigInput,
  type TestImapConnectionInput,
} from "@/models/imapConfig.schema";
import type { ImapConfigResponse } from "@/models/imapConfig.model";
import { testImapConnection } from "@/lib/scraper/email";

function toResponse(config: {
  id: string;
  host: string;
  port: number;
  username: string;
  useTls: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ImapConfigResponse {
  return {
    id: config.id,
    host: config.host,
    port: config.port,
    username: config.username,
    useTls: config.useTls,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function getImapConfig(): Promise<{
  success: boolean;
  data?: ImapConfigResponse | null;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const config = await db.imapConfig.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        host: true,
        port: true,
        username: true,
        useTls: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: config ? toResponse(config) : null };
  } catch (error) {
    return handleError(error, "Failed to fetch IMAP config") as {
      success: boolean;
      message: string;
    };
  }
}

export async function upsertImapConfig(input: UpsertImapConfigInput): Promise<{
  success: boolean;
  data?: ImapConfigResponse;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const parsed = UpsertImapConfigSchema.parse(input);

    const existing = await db.imapConfig.findUnique({
      where: { userId: user.id },
    });

    // Password is required on first create; on update an empty password keeps
    // the stored one.
    const hasNewPassword = !!parsed.password && parsed.password.length > 0;
    if (!existing && !hasNewPassword) {
      return { success: false, message: "Password is required" };
    }

    // On create, credentials always exist (guarded above); on update without a
    // new password, reuse the stored ciphertext untouched.
    const creds =
      hasNewPassword
        ? (() => {
            const { encrypted, iv } = encrypt(parsed.password!);
            return { encryptedPassword: encrypted, iv };
          })()
        : {
            encryptedPassword: existing!.encryptedPassword,
            iv: existing!.iv,
          };

    const saved = await db.imapConfig.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        useTls: parsed.useTls,
        encryptedPassword: creds.encryptedPassword,
        iv: creds.iv,
      },
      update: {
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        useTls: parsed.useTls,
        encryptedPassword: creds.encryptedPassword,
        iv: creds.iv,
      },
      select: {
        id: true,
        host: true,
        port: true,
        username: true,
        useTls: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: toResponse(saved) };
  } catch (error) {
    return handleError(error, "Failed to save IMAP config") as {
      success: boolean;
      message: string;
    };
  }
}

export async function deleteImapConfig(): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    await db.imapConfig.deleteMany({ where: { userId: user.id } });
    return { success: true };
  } catch (error) {
    return handleError(error, "Failed to delete IMAP config") as {
      success: boolean;
      message: string;
    };
  }
}

// Tests a connection. Uses the posted password if present, otherwise falls back
// to the stored (decrypted) one so the user can retest a saved config.
export async function testImapConfig(input: TestImapConnectionInput): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Not authenticated" };

    const parsed = TestImapConnectionSchema.parse(input);

    let password = parsed.password;
    if (!password) {
      const existing = await db.imapConfig.findUnique({
        where: { userId: user.id },
      });
      if (!existing) {
        return { success: false, message: "Password is required" };
      }
      try {
        password = decrypt(existing.encryptedPassword, existing.iv);
      } catch {
        return {
          success: false,
          message: "Stored password could not be read. Re-enter it.",
        };
      }
    }

    const result = await testImapConnection({
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password,
      useTls: parsed.useTls,
    });

    return result.success
      ? { success: true }
      : { success: false, message: result.error };
  } catch (error) {
    return handleError(error, "Connection test failed") as {
      success: boolean;
      message: string;
    };
  }
}
