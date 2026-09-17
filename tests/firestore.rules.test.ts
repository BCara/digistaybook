import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
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
      visibility: "hidden_pending_review",
      message: "Restricted pending review",
    });
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("public Guest Wall access", () => {
  it("denies raw submission, consent, session binding and feedback access", async () => {
    const guest = testEnvironment.authenticatedContext("guest-session", { firebase: { sign_in_provider: "anonymous" } }).firestore();
    for (const path of ["guestSubmissions/test", "guestConsent/test", "guestSessions/guest-session", "properties/live-property/privateFeedback/test"]) {
      await assertFails(getDoc(doc(guest, path)));
      await assertFails(setDoc(doc(guest, path), { uid: "guest-session", status: "published", message: "forged" }));
    }
  });
  it("protects server fields at creation and update", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    for (const forged of [{ billing: {} }, { retentionState: "kept" }, { foundationalPostCount: 99 }, { unexpected: true }]) {
      await assertFails(setDoc(doc(owner, "properties", "forged"), {
        ownerUid: "host-a", name: "Draft", mode: "sandbox", lifecycle: "draft", ...forged
      }));
    }
    for (const forged of [{ mode: "live" }, { foundationalPostCount: 99 }, { serviceEndsAt: new Date("2099-01-01") }, { unexpected: true }]) {
      await assertFails(updateDoc(doc(owner, "properties", "draft-property"), forged));
    }
  });

  it("denies restricted content to the owning host", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "properties", "live-property", "posts", "critical"), { visibility: "restricted", message: "Internal only" });
    });
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    await assertFails(getDoc(doc(owner, "properties", "live-property", "posts", "critical")));
    await assertFails(getDocs(collection(owner, "properties", "live-property", "posts")));
  });

  it("denies direct post reads regardless of lifecycle or visibility switch", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();
    const read = () => getDoc(doc(guest, "properties", "live-property", "posts", "visible-post"));
    const change = (data: Record<string, unknown>) => testEnvironment.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), "properties", "live-property"), data);
    });
    await change({ lifecycle: "cancelled_pending_end", serviceEndsAt: new Date(Date.now() + 3600000) });
    await assertFails(read());
    await change({ serviceEndsAt: new Date(Date.now() - 1000) });
    await assertFails(read());
    await change({ lifecycle: "active", profile: { displayWallOff: true } });
    await assertFails(read());
  });
  it("denies raw property and post records to unauthenticated viewers", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(guest, "properties", "live-property")));
    await assertFails(getDoc(doc(guest, "properties", "live-property", "posts", "visible-post")));
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

  it("requires server creation and address reservation even for an owned sandbox draft", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertFails(
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

  it("lets the dashboard list a Host's own properties and no one else's", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    const otherHost = testEnvironment.authenticatedContext("host-b").firestore();
    const owned = (database: typeof owner, uid: string) =>
      query(collection(database, "properties"), where("ownerUid", "==", uid));

    await assertSucceeds(getDocs(owned(owner, "host-a")));
    // host-b owns nothing, so the same self-scoped query is legal but empty.
    await assertSucceeds(getDocs(owned(otherHost, "host-b")));
    // Asking for another Host's properties, or for the whole collection, is refused.
    await assertFails(getDocs(owned(otherHost, "host-a")));
    await assertFails(getDocs(collection(otherHost, "properties")));
  });

  it("denies an unauthenticated visitor any property listing", async () => {
    const guest = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDocs(collection(guest, "properties")));
    await assertFails(getDocs(query(collection(guest, "properties"), where("mode", "==", "live"))));
  });

  it("lets an owner count the memories on their wall, hidden ones included", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    const posts = collection(owner, "properties", "live-property", "posts");

    await assertSucceeds(getDocs(query(posts, where("visibility", "==", "visible"))));
    await assertSucceeds(getDocs(query(posts, where("visibility", "==", "hidden_pending_review"))));
  });

  it("does not let another Host count the memories on a wall they do not own", async () => {
    const otherHost = testEnvironment.authenticatedContext("host-b").firestore();
    const posts = collection(otherHost, "properties", "live-property", "posts");

    await assertFails(getDocs(query(posts, where("visibility", "==", "hidden_pending_review"))));
  });

  it("allows a Host to rename an owned property but not restate its billing", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    const property = doc(owner, "properties", "draft-property");

    await assertSucceeds(updateDoc(property, { name: "Renamed House" }));
    await assertFails(updateDoc(property, { billing: { currentPeriodEndsAt: "2030-01-01" } }));
  });

  it("refuses a client change to a wall address a QR display was printed from", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();
    const property = doc(owner, "properties", "draft-property");

    await assertFails(updateDoc(property, { slug: "renamed-house" }));
    await assertFails(updateDoc(property, { name: "Renamed House", slug: "renamed-house" }));
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

  it("denies raw records to anonymous sessions; public reads use the callable", async () => {
    const guest = anonymous();

    await assertFails(getDoc(doc(guest, "properties", "live-property")));
    await assertFails(getDoc(doc(guest, "properties", "live-property", "posts", "visible-post")));
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

  it("requires the creation callable for both password and SSO hosts", async () => {
    await assertFails(
      setDoc(doc(host("password"), "properties", "password-draft"), {
        ownerUid: "host-a",
        name: "Password draft",
        mode: "sandbox",
        lifecycle: "draft",
      }),
    );
    await assertFails(
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

describe("Billing state boundaries", () => {
  // BOP §4.1 gives the 28-day trial to a Host's first activated property only.
  // The flag that records it is server-owned; a Host who could clear it would
  // hold a free trial on every property they create.
  it("keeps a Host out of their own trial-eligibility record", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertFails(getDoc(doc(owner, "hosts", "host-a")));
    await assertFails(setDoc(doc(owner, "hosts", "host-a"), { trialConsumedAt: null }));
  });

  // BOP §5.7: webhook processing is idempotent. The ledger is what makes that
  // true, so deleting a row would let a delivered activation be replayed.
  it("keeps every client out of the webhook ledger", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertFails(getDoc(doc(owner, "stripeEvents", "evt_1")));
    await assertFails(setDoc(doc(owner, "stripeEvents", "evt_1"), { type: "invoice.paid" }));
    await assertFails(deleteDoc(doc(owner, "stripeEvents", "evt_1")));
  });

  // §4.2: nothing in the client grants access. `lifecycle` and `billing` are
  // already outside the update allowlist; this states it as a boundary rather
  // than leaving it as a consequence of the field list.
  it("refuses a Host writing their own entitlement", async () => {
    const owner = testEnvironment.authenticatedContext("host-a").firestore();

    await assertFails(updateDoc(doc(owner, "properties", "draft-property"), { lifecycle: "active" }));
    await assertFails(updateDoc(doc(owner, "properties", "draft-property"), { mode: "live" }));
    await assertFails(
      updateDoc(doc(owner, "properties", "draft-property"), { billing: { stripeSubscriptionId: "sub_x" } }),
    );
    await assertFails(updateDoc(doc(owner, "properties", "live-property"), { serviceEndsAt: null }));
  });
});
