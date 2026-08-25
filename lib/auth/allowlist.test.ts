import { describe, expect, it } from "vitest";
import { getAllowedEmails, isEmailAllowed } from "./allowlist";

describe("email allowlist", () => {
  it("ปรับอีเมลเป็นตัวพิมพ์เล็กและตัดช่องว่าง", () => {
    expect(getAllowedEmails(" Nart@Example.com, team@example.com ")).toEqual([
      "nart@example.com",
      "team@example.com",
    ]);
  });

  it("อนุญาตเฉพาะอีเมลที่กำหนด", () => {
    expect(isEmailAllowed("NART@example.com", "nart@example.com")).toBe(true);
    expect(isEmailAllowed("other@example.com", "nart@example.com")).toBe(false);
    expect(isEmailAllowed(null, "nart@example.com")).toBe(false);
  });
});
