import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { EmailFilterType } from "@/models/automation.model";
import type { ScraperError, ScraperResult } from "../types";

export interface ImapConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
}

export interface AlertEmail {
  messageId: string;
  subject: string;
  from: string;
  html: string | null;
  text: string | null;
}

export interface FetchAlertEmailsParams {
  conn: ImapConnectionParams;
  filterType: EmailFilterType;
  filterValue: string;
  // Message-IDs already turned into jobs — skipped so a re-run does no work.
  processedIds: Set<string>;
  // Cap per run to bound LLM cost when a filter matches a large mailbox.
  limit: number;
}

function buildClient(conn: ImapConnectionParams): ImapFlow {
  return new ImapFlow({
    host: conn.host,
    port: conn.port,
    secure: conn.useTls,
    auth: { user: conn.username, pass: conn.password },
    // The library logs verbosely at info level; silence it for our runs.
    logger: false,
  });
}

function toScraperError(error: unknown): ScraperError {
  const message = error instanceof Error ? error.message : "IMAP error";
  if (/auth|login|credential|invalid/i.test(message)) {
    return { type: "blocked", reason: `IMAP authentication failed: ${message}` };
  }
  return { type: "network", message };
}

// Verifies credentials by connecting and logging out. Used by the settings
// "Test connection" action and surfaced verbatim to the user on failure.
export async function testImapConnection(
  conn: ImapConnectionParams,
): Promise<{ success: true } | { success: false; error: string }> {
  const client = buildClient(conn);
  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (error) {
    try {
      await client.close();
    } catch {
      // ignore
    }
    const message = error instanceof Error ? error.message : "IMAP error";
    return { success: false, error: message };
  }
}

// A "label" filter opens that mailbox/folder directly (Gmail exposes labels as
// folders); "sender"/"subject" search INBOX by header. Returns the newest
// unprocessed matches, most recent first, capped at `limit`.
export async function fetchAlertEmails(
  params: FetchAlertEmailsParams,
): Promise<ScraperResult<AlertEmail[]>> {
  const { conn, filterType, filterValue, processedIds, limit } = params;
  const mailbox = filterType === "label" ? filterValue : "INBOX";

  const client = buildClient(conn);
  let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;

  try {
    await client.connect();

    try {
      lock = await client.getMailboxLock(mailbox);
    } catch (error) {
      await client.logout().catch(() => {});
      const message = error instanceof Error ? error.message : "mailbox error";
      return {
        success: false,
        error: {
          type: "parse",
          message:
            filterType === "label"
              ? `Mailbox/label "${filterValue}" not found: ${message}`
              : message,
        },
      };
    }

    const query =
      filterType === "sender"
        ? { from: filterValue }
        : filterType === "subject"
          ? { subject: filterValue }
          : {}; // label: everything in the opened mailbox

    const uids = (await client.search(query, { uid: true })) || [];
    // Newest first, then cap. `search` returns ascending UIDs.
    const selected = uids.sort((a, b) => b - a).slice(0, limit * 3);

    const emails: AlertEmail[] = [];
    for await (const msg of client.fetch(
      selected,
      { uid: true, source: true, envelope: true },
      { uid: true },
    )) {
      if (emails.length >= limit) break;
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);
      const messageId = (msg.envelope?.messageId || parsed.messageId || "").trim();
      if (!messageId || processedIds.has(messageId)) continue;

      emails.push({
        messageId,
        subject: parsed.subject ?? msg.envelope?.subject ?? "",
        from: parsed.from?.text ?? "",
        html: typeof parsed.html === "string" ? parsed.html : null,
        text: parsed.text ?? null,
      });
    }

    await client.logout();
    return { success: true, data: emails };
  } catch (error) {
    try {
      await client.close();
    } catch {
      // ignore
    }
    return { success: false, error: toScraperError(error) };
  } finally {
    if (lock) lock.release();
  }
}
