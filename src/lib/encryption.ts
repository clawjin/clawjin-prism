// src/lib/encryption.ts
// Clawjin Prism — Token Encryption
// 
// ALL OAuth tokens (Shopify, Meta, Google, TikTok) are encrypted
// before storing in database using AES-256-GCM.
//
// Why AES-256-GCM:
// → 256-bit key = military grade encryption
// → GCM mode = authenticated encryption (detects tampering)
// → Unique IV per encryption = same token encrypted twice gives different result
// → Auth tag = proves data was not modified
//
// Storage format in database:
// "iv:authTag:encryptedData" (all hex encoded)
//
// If ENCRYPTION_KEY is missing → app crashes immediately
// Never silently fail on encryption errors

import crypto from "node:crypto";

const ALGORITHM   = "aes-256-gcm";
const IV_LENGTH   = 16; // bytes
const TAG_LENGTH  = 16; // bytes

// Load and validate encryption key at startup
// Key must be 32 bytes = 64 hex characters
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "[encryption] ENCRYPTION_KEY is not set in environment variables. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `[encryption] ENCRYPTION_KEY must be 64 hex characters (32 bytes). ` +
      `Got ${keyHex.length} characters.`
    );
  }

  return Buffer.from(keyHex, "hex");
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypts a plain text string (OAuth token, API key etc.)
 * Returns: "iv:authTag:encryptedData" (hex encoded, colon separated)
 * 
 * Example:
 * encrypt("shpat_abc123") 
 * → "a1b2c3...:d4e5f6...:789abc..."
 */
export function encrypt(plainText: string): string {
  if (!plainText) {
    throw new Error("[encryption] Cannot encrypt empty string");
  }

  const key = getEncryptionKey();

  // Random IV — different every time so same token
  // encrypted twice produces different ciphertext
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the token
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  // Auth tag proves the data was not tampered with
  const authTag = cipher.getAuthTag();

  // Store as "iv:authTag:encryptedData"
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypts an encrypted token back to plain text
 * Input: "iv:authTag:encryptedData" (from database)
 * Returns: original plain text token
 * 
 * Throws if:
 * → Format is wrong (corrupted data)
 * → Auth tag does not match (data was tampered)
 * → Wrong encryption key
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error("[encryption] Cannot decrypt empty string");
  }

  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error(
      `[encryption] Invalid encrypted data format. ` +
      `Expected "iv:authTag:data", got ${parts.length} parts.`
    );
  }

  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];

  const key     = getEncryptionKey();
  const iv      = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data    = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "[encryption] Decryption failed. " +
      "Data may be corrupted or encrypted with a different key."
    );
  }
}

// ── Safe Versions (for non-critical paths) ────────────────────────────────────

/**
 * Encrypts a token, returns null if token is empty/null
 * Use when token might not exist yet
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return encrypt(token);
}

/**
 * Decrypts a token, returns null if encrypted data is empty/null
 * Logs error instead of throwing — use for non-critical decryption
 */
export function decryptToken(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;
  try {
    return decrypt(encryptedData);
  } catch (err) {
    console.error("[encryption] Failed to decrypt token:", err);
    return null;
  }
}

// ── Test Function (development only) ─────────────────────────────────────────

/**
 * Verify encryption is working correctly
 * Call this during startup in development
 */
export function testEncryption(): boolean {
  try {
    const original  = "test-token-shopify-abc123";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    if (decrypted !== original) {
      throw new Error("Decrypted value does not match original");
    }

    // Verify same input gives different ciphertext (random IV)
    const encrypted2 = encrypt(original);
    if (encrypted === encrypted2) {
      throw new Error("Same input produced same ciphertext — IV is not random");
    }

    console.log("[encryption] ✓ Encryption test passed");
    return true;

  } catch (err) {
    console.error("[encryption] ✗ Encryption test failed:", err);
    return false;
  }
}