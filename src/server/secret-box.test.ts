// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { open, seal, secretKey } from "./secret-box";

const key = secretKey(randomBytes(32).toString("base64"));
const other = secretKey(randomBytes(32).toString("base64"));
const TOKEN = "1//0gFAKE-refresh-token-for-tests";

describe("sealing secrets", () => {
  it("opens what it sealed, for the same purpose and owner", () => {
    const sealed = seal(TOKEN, key, "gmail:user-a");
    expect(sealed.keyId).toBe(key.id);
    expect(sealed.sealed).not.toContain(TOKEN);
    expect(open(sealed, [key], "gmail:user-a")).toBe(TOKEN);
  });

  it("never seals the same way twice", () => {
    expect(seal(TOKEN, key, "x").sealed).not.toBe(seal(TOKEN, key, "x").sealed);
  });

  it("refuses anything altered, sealed for someone else, or by another key", () => {
    const sealed = seal(TOKEN, key, "gmail:user-a");
    const [v, iv, tag, body] = sealed.sealed.split(".");
    const flipped = `${v}.${iv}.${tag}.${body!.slice(0, -2)}${body!.endsWith("A") ? "B" : "A"}${body!.slice(-1)}`;
    expect(() => open({ ...sealed, sealed: flipped }, [key], "gmail:user-a")).toThrow();
    expect(() => open(sealed, [key], "gmail:user-b")).toThrow();
    expect(() => open(sealed, [other], "gmail:user-a")).toThrow();
    expect(() => open({ ...sealed, keyId: other.id }, [key, other], "gmail:user-a")).toThrow();
  });

  it("a rotated-out key still opens what it sealed, while it is kept", () => {
    const sealed = seal(TOKEN, key, "c");
    expect(open(sealed, [other, key], "c")).toBe(TOKEN);
  });

  it("only takes 32-byte keys", () => {
    expect(() => secretKey(randomBytes(16).toString("base64"))).toThrow();
    expect(key.id).toMatch(/^[0-9a-f]{16}$/);
  });
});
