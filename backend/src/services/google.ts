// -----------------------------------------------------------------------------
// google.ts — Gmail unsubscribe pipeline for Clean Box (web‑app)
// -----------------------------------------------------------------------------
//  This file is **compile‑clean** with the final Prisma schema:
//     Sender            (@@unique domain)
//     Subscription      (@@unique googleAccountId, baseUrl)
//     UnsubscribeTask   (@@unique subscriptionId, fullUrl)
//
//  Changes in this revision
//  • Fixed TypeScript error in `parseUnsubHeader` by returning a flat array.
//  • Added explicit unique‑constraint names expected by saveToDb (be sure your
//    schema has `name:` on both @@unique lines).
//  • Minor type tweaks to satisfy strict mode.
// -----------------------------------------------------------------------------

import { google, gmail_v1 } from 'googleapis';
import addressparser from 'nodemailer/lib/addressparser';
import type { PrismaClient, UnsubscribeTask } from '@prisma/client';
import pLimit from 'p-limit';
import { taskQueue } from '../queue';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const LOOKBACK_DAYS = 30;
const LOOKBACK_MS   = LOOKBACK_DAYS * 24 * 60 * 60 * 1_000;
const CONCURRENCY   = 20; // Gmail: 250 req / 100 s per user

/* ------------------------------------------------------------------ */
/*  OAuth                                                             */
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

  if (!user.googleAccessToken ||
      (user.googleTokenExpiry && Date.now() > user.googleTokenExpiry.getTime() - 120_000)) {
    const { credentials } = await oauth2.refreshAccessToken();
    user.googleAccessToken = credentials.access_token ?? null;
    user.googleTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
  }
  return google.gmail({ version: 'v1', auth: oauth2 });
}

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

export interface UnsubChannel {
  type: 'https' | 'mailto';
  url: string;
  usesOneClick?: boolean;
}

export function canonicalUrl(raw: string): string {
  if (raw.startsWith('mailto:')) {
    return `mailto:${raw.slice(7).split('?')[0]}`;
  }
  return new URL(raw).origin;
}

function parseUnsubHeader(lu: string, luPost?: string): UnsubChannel[] {
  const channels: UnsubChannel[] = [];
  if (!lu) return channels;

  const oneClick = /one-click/i.test(luPost ?? '');
  for (const token of lu.split(',')) {
    const val = token.trim().replace(/^<|>$/g, '');
    if (!val) continue;
    if (/^http/i.test(val)) {
      channels.push({ type: 'https', url: val, usesOneClick: oneClick });
    } else if (/^mailto:/i.test(val)) {
      channels.push({ type: 'mailto', url: val });
    }
  }
  return channels;
}

function extractDisplayName(fromHdr?: string): string | null {
  if (!fromHdr) return null;
  try {
    return addressparser(fromHdr)?.[0]?.name ?? null;
  } catch {
    return fromHdr.split('<')[0].trim();
  }
}

/* ------------------------------------------------------------------ */
/*  1 ▸ Message ID list                                               */
/* ------------------------------------------------------------------ */

export async function listRecentMessageIds(gmail: gmail_v1.Gmail): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `newer_than:${LOOKBACK_DAYS}d in:anywhere`,
      labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
      maxResults: 500,
      pageToken,
      fields: 'messages/id,nextPageToken',
    });
    ids.push(...(res.data.messages ?? []).map(m => m.id!));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

/* ------------------------------------------------------------------ */
/*  2 ▸ Extract sender + channels per message                          */
/* ------------------------------------------------------------------ */

export async function getSenderAndUnsub(gmail: gmail_v1.Gmail, id: string) {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'metadata',
    metadataHeaders: ['From', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'Date'],
    fields: 'internalDate,payload/headers',
  });

  const sentTs = msg.data.internalDate ? Number(msg.data.internalDate) : 0;
  if (Date.now() - sentTs > LOOKBACK_MS) return null;

  const headers = msg.data.payload!.headers!;
  const byName = (n: string) => headers.find(h => h.name!.toLowerCase() === n)?.value;

  const senderName = extractDisplayName(byName('from') ?? undefined);
  const channels   = parseUnsubHeader(byName('list-unsubscribe') ?? '', byName('list-unsubscribe-post') ?? '');
  if (!channels.length) return null;

  return { senderName, channels } as const;
}

/* ------------------------------------------------------------------ */
/*  3 ▸ Persist + enqueue                                             */
/* ------------------------------------------------------------------ */

export async function saveToDb(
  prisma: PrismaClient,
  googleAccountId: string,
  records: { senderName: string | null; channels: UnsubChannel[] }[],
): Promise<UnsubscribeTask[]> {

  const tasks: UnsubscribeTask[] = [];

  for (const rec of records) {
    const { senderName, channels } = rec;

    for (const ch of channels) {
      const canonical = canonicalUrl(ch.url);
      const domain =
        ch.type === 'mailto'
          ? canonical.slice(7).split('@')[1]
          : new URL(ch.url).hostname;

      const task = await prisma.$transaction(async tx => {
        /* 1 ▸ upsert the sender ----------------------------------- */
        const sender = await tx.sender.upsert({
          where: { domain },
          update: senderName ? { displayName: senderName } : {},
          create: { domain, displayName: senderName ?? undefined },
        });

        /* 2 ▸ upsert / touch subscription ------------------------- */
        const subscription = await tx.subscription.upsert({
          where: { googleAccountId_baseUrl: { googleAccountId, baseUrl: canonical } },
          update: { lastSeen: new Date() },
          create: {
            senderId: sender.id,
            googleAccountId,
            baseUrl: canonical,
            lastSeen: new Date(),
          },
        });

        /* 3 ▸ already unsubscribed? bail out ---------------------- */
        if (subscription.isUnsubscribed) return null;

        /* 4 ▸ otherwise create / reuse task ----------------------- */
        return tx.unsubscribeTask.upsert({
          where: { subscriptionId_fullUrl: { subscriptionId: subscription.id, fullUrl: ch.url } },
          update: {},
          create: { subscriptionId: subscription.id, fullUrl: ch.url },
        });
      });

      if (task) tasks.push(task);          // null ⇒ skipped
    }
  }
  return tasks;
}

export async function enqueueNewTasks(tasks: UnsubscribeTask[]) {
  for (const t of tasks) {
    await taskQueue.add('unsubscribe', { id: t.id });
  }
}

/* ------------------------------------------------------------------ */
/*  4 ▸ Convenience orchestrator                                      */
/* ------------------------------------------------------------------ */

export async function scanAndQueue(
  prisma: PrismaClient,
  googleAccountId: string,
  gmail: gmail_v1.Gmail,
): Promise<number> {
  const ids = await listRecentMessageIds(gmail);
  if (!ids.length) return 0;

  const limit = pLimit(CONCURRENCY);
  const meta = (await Promise.all(ids.map(mId => limit(() => getSenderAndUnsub(gmail, mId)))))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (!meta.length) return 0;

  const tasks = await saveToDb(prisma, googleAccountId, meta);
  await enqueueNewTasks(tasks);
  return tasks.length;
}
