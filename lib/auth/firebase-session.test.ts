import { describe, expect, it } from "vitest";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  hasRecentFirebaseSignIn,
  identityFromFirebaseToken,
} from "./firebase-session";

function token(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    aud: "project",
    auth_time: 1_000,
    exp: 2_000,
    firebase: { identities: {}, sign_in_provider: "google.com" },
    iat: 1_000,
    iss: "https://securetoken.google.com/project",
    sub: "uid",
    uid: "uid",
    ...overrides,
  };
}

describe("Firebase session helpers", () => {
  it("accepts a verified email and normalizes it", () => {
    expect(
      identityFromFirebaseToken(
        token({
          email: " Nart@Example.com ",
          email_verified: true,
          name: "Nart",
          picture: "https://example.com/avatar.png",
        }),
      ),
    ).toEqual({
      email: "nart@example.com",
      name: "Nart",
      image: "https://example.com/avatar.png",
    });
  });

  it("rejects missing or unverified email", () => {
    expect(identityFromFirebaseToken(token())).toBeNull();
    expect(
      identityFromFirebaseToken(
        token({ email: "nart@example.com", email_verified: false }),
      ),
    ).toBeNull();
  });

  it("requires a sign-in no older than five minutes", () => {
    expect(hasRecentFirebaseSignIn(token({ auth_time: 1_000 }), 1_300)).toBe(
      true,
    );
    expect(hasRecentFirebaseSignIn(token({ auth_time: 1_000 }), 1_301)).toBe(
      false,
    );
  });
});
