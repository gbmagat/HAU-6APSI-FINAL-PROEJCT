import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("invited-account passwords", () => {
  it("stores a salted hash and verifies only the matching password", async () => {
    const password = "correct horse battery staple";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("a different password", first)).toBe(false);
  });

  it("rejects malformed hashes and short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
    expect(await verifyPassword("anything", "not-a-password-hash")).toBe(false);
  });
});
