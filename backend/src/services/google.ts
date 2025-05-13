import { google, gmail_v1 } from 'googleapis';
import { taskQueue } from '../queue';
import type { PrismaClient, UnsubscribeTask } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

// how far back to look for subscriptions
const LOOKBACK_DAYS = 30;
const LOOKBACK_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  OAuth helper                                                      */
/* ------------------------------------------------------------------ */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
}

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

  // refresh if missing or <2 min left
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
/*  Step 1: list candidate message IDs                                */
/* ------------------------------------------------------------------ */
export async function listRecentMessageIds(
  gmail: gmail_v1.Gmail,
): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    // only look at inbox + promo to cut noise; tweak as you like
    labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
    maxResults: 500,
  });

  return (res.data.messages ?? []).map(m => m.id!).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Step 2: get List‑Unsubscribe URL if header exists + fresh enough  */
/* ------------------------------------------------------------------ */
export async function getUnsubscribeUrlIfRecent(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<string | null> {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['List-Unsubscribe', 'Date'],
  });

  // 2a. age check (use internalDate if present, else Date header)
  const internalTs = msg.data.internalDate
    ? Number(msg.data.internalDate)
    : NaN;
  let sentTs = internalTs;
  if (Number.isNaN(sentTs)) {
    const dateHdr = msg.data.payload?.headers?.find(h => h.name === 'Date')
      ?.value;
    sentTs = dateHdr ? Date.parse(dateHdr) : 0;
  }
  if (Date.now() - sentTs > LOOKBACK_MS) return null; // too old

  // 2b. extract unsubscribe header
  const header = msg.data.payload?.headers?.find(
    h => h.name?.toLowerCase() === 'list-unsubscribe',
  );
  if (!header?.value) return null;

  const match = header.value.match(/<([^>]+)>/);
  return match ? match[1] : header.value.split(',')[0].trim();
}

/* ------------------------------------------------------------------ */
/*  Step 3: bulk‑insert tasks (skip duplicates)                        */
/* ------------------------------------------------------------------ */
export async function createTasks(
  prisma: PrismaClient,
  googleAccountId: string,
  urls: string[],
): Promise<UnsubscribeTask[]> {
  const created: UnsubscribeTask[] = [];
  for (const url of urls) {
    try {
      const task = await prisma.unsubscribeTask.upsert({
        where: { googleAccountId_url: { googleAccountId, url } }, 
        update: {},
        create: { googleAccountId, url },                        
      });
      created.push(task);
    } catch {
      /* duplicate – ignore */
    }
  }
  return created;
}
