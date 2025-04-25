// src/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES GCM

// Ensure the encryption key is loaded and valid on startup
let encryptionKey: Buffer;
try {
    if (!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
        throw new Error('Missing GOOGLE_TOKEN_ENCRYPTION_KEY environment variable.');
    }
    encryptionKey = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY, 'hex');
    if (encryptionKey.length !== 32) {
         throw new Error('Invalid GOOGLE_TOKEN_ENCRYPTION_KEY environment variable (must be 64 hex characters, representing 32 bytes).');
    }
    console.log('[Encryption] GOOGLE_TOKEN_ENCRYPTION_KEY loaded successfully.');
} catch (err: any) {
     console.error("CRITICAL ERROR initializing encryption key:", err.message);
     // Optional: Exit the process if the key is essential for startup
     // process.exit(1);
     // Or handle appropriately if the app can run partially without it (unlikely here)
     throw err; // Re-throw to potentially stop server startup if not handled
}


/**
 * Encrypts plaintext using AES-256-GCM.
 * @param text The plaintext string to encrypt.
 * @returns The encrypted data as a hex string (IV + AuthTag + Ciphertext).
 */
export function encrypt(text: string): string {
    if (!text) {
        console.warn('[Encryption] Attempted to encrypt empty or null text.');
        return text; // Return as is if empty/null
    }
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        // Store IV and AuthTag along with the encrypted data
        return Buffer.concat([iv, authTag, encrypted]).toString('hex');
    } catch (error) {
         console.error("[Encryption] Encryption failed:", error);
         throw new Error("Encryption process failed."); // Re-throw specific error
    }
}

/**
 * Decrypts a hex string (IV + AuthTag + Ciphertext) using AES-256-GCM.
 * @param encryptedHex The hex string containing the encrypted data.
 * @returns The original plaintext string.
 * @throws Throws an error if decryption fails (e.g., wrong key, corrupt data).
 */
export function decrypt(encryptedHex: string): string {
    if (!encryptedHex) {
         console.warn('[Encryption] Attempted to decrypt empty or null hex string.');
        return encryptedHex; // Return as is if empty/null
    }
    try {
        const encryptedData = Buffer.from(encryptedHex, 'hex');
        // Extract IV, AuthTag, and the actual encrypted text
        const iv = encryptedData.subarray(0, IV_LENGTH);
        const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + 16); // GCM auth tag is 16 bytes
        const encryptedText = encryptedData.subarray(IV_LENGTH + 16);

        // Create decipher and set the authentication tag
        const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
        decipher.setAuthTag(authTag);

        // Decrypt and return as UTF-8 string
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error("[Encryption] Decryption failed:", error);
        // It's crucial to know decryption failed, as using a corrupt token is bad.
        throw new Error("Failed to decrypt token. It might be corrupted or the key might be wrong.");
    }
}
