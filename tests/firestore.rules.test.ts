import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-digistaybook";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "properties", "live-property"), {
      ownerUid: "host-a",
      name: "Harbour House",
      mode: "live",
      lifecycle: "active",
    });
    await setDoc(doc(database, "properties", "draft-property"), {
      ownerUid: "host-a",
      name: "Unpublished House",
      mode: "sandbox",
      lifecycle: "draft",
    });
    await setDoc(doc(database, "properties", "live-property", "posts", "visible-post"), {
      visibility: "visible",
      message: "A lovely stay",
    });
    await setDoc(doc(database, "properties", "live-property", "posts", "hidden-post"), {
      visibility: "hidden",
      message: "Restricted pending review",
    });
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("public Guest Wall access", () => {
  it("allows an unauthenticated guest to read a live eligible property and visible post", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(guest, "properties", "live-property")));
    await assertSucceeds(getDoc(doc(guest, "properties", "live-property", "posts", "visible-post")));
  });

  it("denies unpublished properties and hidden posts", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(guest, "properties", "draft-property")));
    await assertFails(getDoc(doc(guest, "properties", "live-property", "posts", "hidden-post")));
  });

  it("denies direct guest content writes and deletion", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();
    const newPost = doc(guest, "properties", "live-property", "posts", "new-post");

    await assertFails(setDoc(newPost, { visibility: "visible", message: "Unsafe direct write" }));
    await assertFails(deleteDoc(doc(guest, "properties", "live-property", "posts", "visible-post")));
  });
});

describe("Host ownership boundaries", () => {
  it("allows an owner to read their draft and restricted content", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertSucceeds(getDoc(doc(owner, "properties", "draft-property")));
    await assertSucceeds(getDoc(doc(owner, "properties", "live-property", "posts", "hidden-post")));
  });

  it("does not grant a different Host access to another Host's unpublished property", async () => {
    const otherHost = testEnvironment.authenticatedContext("host-b").firestore();

    await assertFails(getDoc(doc(otherHost, "properties", "draft-property")));
  });

  it("allows a Host to create only an owned sandbox draft", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertSucceeds(
      setDoc(doc(owner, "properties", "new-draft"), {
        ownerUid: "host-a",
        name: "New draft",
        mode: "sandbox",
        lifecycle: "draft",
      }),
    );
    await assertFails(
      setDoc(doc(owner, "properties", "forged-live-property"), {
        ownerUid: "host-a",
        name: "Forged live property",
        mode: "live",
        lifecycle: "active",
      }),
    );
  });

  it("prevents ownership transfer and client-controlled lifecycle changes", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    const property = doc(owner, "properties", "draft-property");

    await assertFails(updateDoc(property, { ownerUid: "host-b" }));
    await assertFails(updateDoc(property, { lifecycle: "active" }));
  });
});

describe("Host profile boundaries", () => {
  it("allows a Host to create only their own bounded profile", async () => {
    const owner = testEnvironment.authenticatedContext("host-a", { email: "host@example.com" }).firestore();

    await assertSucceeds(
      setDoc(doc(owner, "users", "host-a"), {
        displayName: "Host A",
        email: "host@example.com",
        createdAt: "server-controlled-placeholder",
        updatedAt: "server-controlled-placeholder",
      }),
    );
    await assertFails(
      setDoc(doc(owner, "users", "host-b"), {
        displayName: "Host B",
        email: "host-b@example.com",
        createdAt: "server-controlled-placeholder",
        updatedAt: "server-controlled-placeholder",
      }),
    );
  });
});

describe("Guest anonymous session boundaries", () => {
  const anonymous = () =>
    testEnvironment
      .authenticatedContext("guest-session-1", { firebase: { sign_in_provider: "anonymous" } })
      .firestore();

  it("still allows an anonymous Guest session to read the public wall", async () => {
    const guest = anonymous();

    await assertSucceeds(getDoc(doc(guest, "properties", "live-property")));
    await assertSucceeds(getDoc(doc(guest, "properties", "live-property", "posts", "visible-post")));
  });

  it("denies an anonymous Guest session a Host profile document", async () => {
    const guest = anonymous();

    await assertFails(
      setDoc(doc(guest, "users", "guest-session-1"), {
        displayName: "Not a Host",
        email: "guest@example.com",
        createdAt: "server-controlled-placeholder",
        updatedAt: "server-controlled-placeholder",
      }),
    );
  });

  it("denies an anonymous Guest session property creation", async () => {
    const guest = anonymous();

    await assertFails(
      setDoc(doc(guest, "properties", "guest-created-property"), {
        ownerUid: "guest-session-1",
        name: "Property from a wall visitor",
        mode: "sandbox",
        lifecycle: "draft",
      }),
    );
  });

  it("denies an anonymous Guest session another Host's unpublished property", async () => {
    const guest = anonymous();

    await assertFails(getDoc(doc(guest, "properties", "draft-property")));
  });
});

describe("Host sign-in providers", () => {
  const host = (provider: "password" | "google.com") =>
    testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: provider } }).firestore();

  it("allows a password Host and an SSO Host the same owned draft creation", async () => {
    await assertSucceeds(
      setDoc(doc(host("password"), "properties", "password-draft"), {
        ownerUid: "host-a",
        name: "Password draft",
        mode: "sandbox",
        lifecycle: "draft",
      }),
    );
    await assertSucceeds(
      setDoc(doc(host("google.com"), "properties", "sso-draft"), {
        ownerUid: "host-a",
        name: "SSO draft",
        mode: "sandbox",
        lifecycle: "draft",
      }),
    );
  });

  it("allows an SSO Host to read their own unpublished property", async () => {
    await assertSucceeds(getDoc(doc(host("google.com"), "properties", "draft-property")));
  });
});
