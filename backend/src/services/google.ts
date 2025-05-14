/* ------------------------------------------------------------------ */
/*  Google utilities – unsubscribe pipeline                           */
/* ------------------------------------------------------------------ */

import { google, gmail_v1 } from 'googleapis';
import type { PrismaClient, UnsubscribeTask } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

// How far back to inspect messages
const LOOKBACK_DAYS = 30;
const LOOKBACK_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1_000;

/* ------------------------------------------------------------------ */
/*  OAuth helper                                                      */
/* ------------------------------------------------------------------ */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * Ensure we have a valid access‑token for the given GoogleAccount row –
 * refresh if necessary – and return an authed Gmail client.
 */
export async function getAuthedGmail(user: {
  googleRefreshToken: string;
  googleAccessToken?: string | null;
  googleTokenExpiry?: Date | null;
}): Promise<gmail_v1.Gmail> {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: user.googleAccessToken ?? undefined,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry?.valueOf(),
  });

  // refresh if missing or < 2‑min left
  if (
    !user.googleAccessToken ||
    (user.googleTokenExpiry &&
      Date.now() > user.googleTokenExpiry.getTime() - 120_000)
  ) {
    const { credentials } = await oauth2.refreshAccessToken();
    user.googleAccessToken = credentials.access_token ?? null;
    user.googleTokenExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null;
  }

  return google.gmail({ version: 'v1', auth: oauth2 });
}

/* ------------------------------------------------------------------ */
/*  1. List candidate message IDs                                     */
/* ------------------------------------------------------------------ */
export async function listRecentMessageIds(
  gmail: gmail_v1.Gmail,
): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    // Just Inbox + Promotions to cut noise
    labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
    maxResults: 500,
  });

  return (res.data.messages ?? []).map(m => m.id!).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  2. Fetch { sender, url } if message is fresh & has header          */
/* ------------------------------------------------------------------ */
export async function getSenderAndUnsub(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<{ sender: string | null; url: string | null }> {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'List-Unsubscribe', 'Date'],
  });

  /* ----- age filter ------------------------------------------------ */

  // Prefer internalDate; fallback to Date header
  const internalTs = msg.data.internalDate ? Number(msg.data.internalDate) : NaN;
  let sentTs = internalTs;
  if (Number.isNaN(sentTs)) {
    const dateHdr = msg.data.payload?.headers?.find(h => h.name === 'Date')
      ?.value;
    sentTs = dateHdr ? Date.parse(dateHdr) : 0;
  }
  if (Date.now() - sentTs > LOOKBACK_MS) {
    return { sender: null, url: null };
  }

  /* ----- sender (pretty name) ------------------------------------- */

  const fromHdr = msg.data.payload?.headers?.find(h => h.name === 'From')?.value;
  const sender =
    fromHdr?.match(/"?([^"]+)"?\s*</)?.[1] ?? // "Product Hunt Weekly" <…>
    fromHdr?.split('<')[0].trim() ??
    null;

  /* ----- unsubscribe header --------------------------------------- */

  const lu = msg.data.payload?.headers?.find(
    h => h.name?.toLowerCase() === 'list-unsubscribe',
  )?.value;
  if (!lu) return { sender, url: null };

  const urlMatch = lu.match(/<([^>]+)>/);
  const url = urlMatch ? urlMatch[1] : lu.split(',')[0].trim();

  return { sender, url };
}

/* ------------------------------------------------------------------ */
/*  3. Bulk‑insert tasks (skip duplicates)                             */
/* ------------------------------------------------------------------ */
export async function createTasks(
  prisma: PrismaClient,
  googleAccountId: string,
  rows: { sender: string | null; url: string }[],
): Promise<UnsubscribeTask[]> {
  const created: UnsubscribeTask[] = [];

  for (const { sender, url } of rows) {
    try {
      const task = await prisma.unsubscribeTask.upsert({
        where: { googleAccountId_url: { googleAccountId, url } },
        update: { sender }, // store / refresh sender name
        create: { googleAccountId, sender, url },
      });
      created.push(task);
    } catch {
      // duplicate – ignore
    }
  }

  return created;
}

/* ------------------------------------------------------------------ */
/*  4. Helper: enqueue new tasks                                       */
/* ------------------------------------------------------------------ */
import { taskQueue } from '../queue';

/**
 * Push every freshly‑created task into BullMQ for background processing.
 */
export async function enqueueNewTasks(tasks: UnsubscribeTask[]) {
  for (const t of tasks) {
    await taskQueue.add('unsubscribe', { id: t.id });
  }
}
