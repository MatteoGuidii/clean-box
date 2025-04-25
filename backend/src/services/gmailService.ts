// src/services/gmailService.ts
import { google, gmail_v1 as GmailApi } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { decrypt } from '../utils/encryption';
import prisma from '../db/prisma';

// --- Authentication Helper ---
// (Assuming this function is correctly defined elsewhere or paste it here)
// It needs to fetch user, decrypt token, create/configure OAuth2Client
async function getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    console.log(`[GmailService] Getting auth client for user ${userId}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleRefreshToken: true, isGmailConnected: true }
    });

    if (!user?.isGmailConnected) {
        throw new Error(`User ${userId} is not connected to Gmail.`);
    }
    if (!user.googleRefreshToken) {
         throw new Error(`User ${userId} is connected but refresh token is missing in DB.`);
    }

    let decryptedRefreshToken: string;
    try {
        decryptedRefreshToken = decrypt(user.googleRefreshToken);
    } catch (decryptError) {
         console.error(`[GmailService] Failed to decrypt refresh token for user ${userId}:`, decryptError);
         throw new Error(`Failed to decrypt token for user ${userId}. Re-authentication might be required.`);
    }

    // Use environment variables loaded at startup
    const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        process.env.GOOGLE_CALLBACK_URL!
    );
    oauth2Client.setCredentials({ refresh_token: decryptedRefreshToken });

    // Optional: Listen for token refresh events to update DB
     oauth2Client.on('tokens', async (tokens) => {
         if (tokens.access_token) {
             console.log(`[GmailService] Access token refreshed for user ${userId}. Updating DB (optional).`);
             try {
                 await prisma.user.update({
                     where: { id: userId },
                     data: {
                         googleAccessToken: tokens.access_token,
                         googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
                     }
                 });
             } catch (dbError) {
                  console.error(`[GmailService] Failed to update refreshed token in DB for user ${userId}:`, dbError);
             }
         }
     });

    return oauth2Client;
}

// Function to get a ready-to-use Gmail API client instance for the user.
export async function getGmailClient(userId: string): Promise<GmailApi.Gmail> {
    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });
    return gmail;
}
// --- End Authentication Helper ---


// --- Header Parsing Helper Functions ---
/**
 * Extracts the HTTPS URL from a List-Unsubscribe header value.
 * @param headerValue The raw value of the List-Unsubscribe header.
 * @returns The extracted HTTPS URL or null if not found.
 */
function extractHttpsUnsubscribeUrl(headerValue: string): string | null {
    if (!headerValue) return null;
    // Match URLs within angle brackets < > - prioritize HTTPS
    const urlMatch = headerValue.match(/<(https:\/\/[^>]+)>/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }
    // Add more parsing logic here if needed for non-bracketed HTTPS URLs
    return null;
}

/**
 * Extracts the email address from a From header value.
 * @param headerValue The raw value of the From header.
 * @returns The extracted email address or null if not found.
 */
function extractSenderEmail(headerValue: string): string | null {
    if (!headerValue) return null;
    // Match email addresses within angle brackets < >
    const emailMatch = headerValue.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
        if (/\S+@\S+\.\S+/.test(emailMatch[1])) { // Basic format check
             return emailMatch[1];
        }
    }
    // If no brackets, try to match an email address directly
    const directEmailMatch = headerValue.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/); // More specific regex
     if (directEmailMatch && directEmailMatch[1]) {
         return directEmailMatch[1];
     }
    return null;
}
// --- End Helper Functions ---


/**
 * Scans recent user emails, fetches required headers for each,
 * and creates 'pending_approval' tasks if applicable.
 * @param userId The ID of the user whose inbox to scan.
 * @returns Object with counts of messages processed, new tasks created, and errors encountered.
 */
export async function scanInboxAndCreateTasks(userId: string): Promise<{ processed: number; created: number; errors: number }> {
    console.log(`[GmailScan] Starting scan for user: ${userId}`);
    let processedCount = 0;
    let createdCount = 0;
    let errorCount = 0;
    let gmail: GmailApi.Gmail;

    try {
        // 1. Get Authenticated Client
        gmail = await getGmailClient(userId);
    } catch (authError: any) {
         console.error(`[GmailScan] Failed to get Gmail client for user ${userId}:`, authError.message || authError);
         return { processed: 0, created: 0, errors: 1 }; // Cannot proceed without auth
    }

    try {
        // 2. List *recent* messages (metadata scope doesn't support 'q')
        // Fetch a batch (e.g., 100). Implement pagination for more thorough scans later.
        console.log(`[GmailScan] Listing recent messages for user: ${userId}...`);
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 100, // Fetch a batch of recent messages
            includeSpamTrash: false,
            // labelIds: ['INBOX'], // Optionally focus on specific labels like INBOX
            // --- REMOVED 'q' parameter ---
        });

        const messages = listResponse.data.messages;
        if (!messages || messages.length === 0) {
            console.log(`[GmailScan] No recent messages found to scan for user: ${userId}`);
            return { processed: 0, created: 0, errors: 0 };
        }

        console.log(`[GmailScan] Found ${messages.length} recent messages for user: ${userId}. Fetching headers...`);

        // 3. Process each message individually
        for (const message of messages) {
            if (!message.id) continue;
            processedCount++; // Count every message we attempt to process

            try {
                // 4. Get *only* the required headers for this specific message
                const msgDetails = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata', // Fetch only metadata
                    metadataHeaders: ['List-Unsubscribe', 'From'], // Request specific headers
                });

                const headers = msgDetails.data.payload?.headers;
                if (!headers) continue; // Skip if no headers (unlikely for metadata format)

                // 5. Extract header values
                const unsubscribeHeader = headers.find(h => h.name?.toLowerCase() === 'list-unsubscribe');
                const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');

                // Skip if either essential header is missing a value
                if (!unsubscribeHeader?.value || !fromHeader?.value) {
                    continue;
                }

                // 6. Parse header values to get URL and Sender Email
                const unsubscribeUrl = extractHttpsUnsubscribeUrl(unsubscribeHeader.value);
                const senderEmail = extractSenderEmail(fromHeader.value);

                // Skip if we couldn't get a valid HTTPS URL AND sender email
                if (!unsubscribeUrl || !senderEmail) {
                    continue;
                }

                // 7. Check if task already exists (prevents duplicates)
                const existingTask = await prisma.unsubscribeTask.findFirst({
                    where: {
                        userId: userId,
                        url: unsubscribeUrl,
                        senderEmail: senderEmail,
                        // Optionally add status checks here if needed
                    },
                    select: { id: true } // Only need ID for existence check
                });

                if (existingTask) {
                    // console.log(`[GmailScan] Task already exists for URL: ${unsubscribeUrl} from Sender: ${senderEmail}`);
                    continue; // Skip creating duplicate
                }

                // 8. Create new task with 'pending_approval' status
                const createdTask = await prisma.unsubscribeTask.create({
                    data: {
                        userId: userId,
                        url: unsubscribeUrl,
                        senderEmail: senderEmail,
                        status: 'pending_approval', // Set status for user review
                    }
                });
                createdCount++;
                console.log(`[GmailScan] Created task ${createdTask.id} [pending_approval] for URL: ${unsubscribeUrl} from Sender: ${senderEmail}`);

                // NO BullMQ queuing here - happens after user approval via API

            } catch (msgError: any) {
                 // Log errors processing individual messages but continue with the batch
                 console.error(`[GmailScan] Error processing message ID ${message.id} for user ${userId}:`, msgError.message || msgError);
                 // Check for specific errors like 404 Not Found (message deleted?) which might be okay to ignore
                 if (msgError.code !== 404) {
                    errorCount++;
                 }
            }
        } // End for loop

    } catch (listError: any) {
        // Handle errors during the message listing phase (e.g., API connection issues)
        console.error(`[GmailScan] Error listing messages for user ${userId}:`, listError.message || listError);
        errorCount++;
    }

    console.log(`[GmailScan] Finished scan for user ${userId}. Processed Messages: ${processedCount}, Created Tasks: ${createdCount}, Errors: ${errorCount}`);
    return { processed: processedCount, created: createdCount, errors: errorCount };
}
