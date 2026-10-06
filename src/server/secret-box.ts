import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SealedSecret } from "@/data/repository";

/**
 * Sealing secrets (Gmail refresh tokens, the OAuth handshake cookie) before
 * they leave the server: AES-256-GCM from Node's crypto, a fresh 96-bit IV
 * each time, and a context string as additional authenticated data, so a
 * sealed value only opens for the purpose (and owner) it was sealed for.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url), plus the key's id, so a
 * rotated key can still open what the previous one sealed (ARCHITECTURE.md ›
 * Gmail › Keys).
 */

export type SecretKey = { id: string; key: Buffer };

/** A 32-byte key from base64; its id is a short hash of it, never the key itself. */
export function secretKey(base64: string): SecretKey {
  const key = Buffer.from(base64.trim(), "base64");
  if (key.length !== 32) throw new Error("A secret key must be 32 bytes, base64-encoded");
  return { id: createHash("sha256").update(key).digest("hex").slice(0, 16), key };
}

export function seal(plaintext: string, key: SecretKey, context: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const part = (b: Buffer) => b.toString("base64url");
  return { sealed: `v1.${part(iv)}.${part(tag)}.${part(body)}`, keyId: key.id };
}

/** Opens a sealed value, or throws if it was altered, sealed for another context, or by an unknown key. */
export function open(secret: SealedSecret, keys: readonly SecretKey[], context: string): string {
  const key = keys.find((k) => k.id === secret.keyId);
  if (!key) throw new Error("No key for this sealed secret");
  const [version, iv, tag, body] = secret.sealed.split(".");
  if (version !== "v1" || !iv || !tag || body === undefined) throw new Error("Not a sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", key.key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
