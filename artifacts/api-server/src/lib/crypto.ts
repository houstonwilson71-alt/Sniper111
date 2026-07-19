import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  return crypto.scryptSync(key, "meme-sniper-salt", KEY_LENGTH);
}

export function encrypt(text: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

export function decrypt(encrypted: string): string | null {
  const key = getKey();
  if (!key) return null;
  const parts = encrypted.split(":");
  if (parts.length !== 3) return null;
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes(":");
}
