import { afterEach, describe, expect, it } from "vitest";
import { getDataBackend } from "./data-backend";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Data backend", () => {
  it("uses Postgres by default", () => {
    expect(getDataBackend()).toBe("postgres");
  });

  it("auto-detects Firestore when Firebase is configured", () => {
    process.env.FIREBASE_PROJECT_ID = "import-price-studio-nart";
    expect(getDataBackend()).toBe("firestore");
  });
});
