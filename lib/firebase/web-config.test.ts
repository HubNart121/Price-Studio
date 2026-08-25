import { afterEach, describe, expect, it } from "vitest";
import { getFirebaseWebConfig } from "./web-config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Firebase web configuration", () => {
  it("reads the App Hosting generated JSON", () => {
    expect(
      getFirebaseWebConfig(
        JSON.stringify({
          apiKey: "api-key",
          authDomain: "example.firebaseapp.com",
          projectId: "example",
          appId: "1:123:web:abc",
        }),
      ),
    ).toEqual({
      apiKey: "api-key",
      authDomain: "example.firebaseapp.com",
      projectId: "example",
      appId: "1:123:web:abc",
      messagingSenderId: undefined,
      storageBucket: undefined,
    });
  });

  it("falls back to explicit public variables", () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "example.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "example";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123:web:abc";

    expect(getFirebaseWebConfig("not-json")?.projectId).toBe("example");
  });

  it("rejects incomplete configuration", () => {
    expect(getFirebaseWebConfig("{}")).toBeNull();
  });
});
