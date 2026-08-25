import { afterEach, describe, expect, it } from "vitest";
import { getAuthMode, isGoogleAuthConfigured } from "./config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Auth mode", () => {
  it("uses NextAuth by default", () => {
    expect(getAuthMode(undefined)).toBe("nextauth");
    expect(getAuthMode("nextauth")).toBe("nextauth");
  });

  it("enables Firebase Authentication explicitly", () => {
    expect(getAuthMode("firebase")).toBe("firebase");
    expect(getAuthMode(" FIREBASE ")).toBe("firebase");
  });

  it("auto-detects Firebase when the app is configured for it", () => {
    process.env.FIREBASE_PROJECT_ID = "import-price-studio-nart";
    expect(getAuthMode(undefined)).toBe("firebase");
  });
});

describe("Google auth configuration", () => {
  it("rejects missing and placeholder credentials", () => {
    expect(isGoogleAuthConfigured(undefined, undefined)).toBe(false);
    expect(isGoogleAuthConfigured("not-configured", "not-configured")).toBe(
      false,
    );
  });

  it("accepts a non-placeholder client id and secret", () => {
    expect(
      isGoogleAuthConfigured(
        "client.apps.googleusercontent.com",
        "real-client-secret",
      ),
    ).toBe(true);
  });
});
