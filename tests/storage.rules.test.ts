// @vitest-environment node
//
// The Storage SDK uploads through XHR, which jsdom does not implement well
// enough to accept a byte payload, so these run against Node like the server
// they are testing. Nothing here renders.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes, deleteObject } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Property media boundaries.
 *
 * A cover photograph is as public as the wall that renders it, and the rules
 * decide that by reading the property document — so these tests run against
 * both emulators and seed Firestore before touching the bucket.
 */
const projectId = "demo-digistaybook";
let testEnvironment: RulesTestEnvironment;

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
const jpeg = { contentType: "image/jpeg" };

const livePath = "properties/live-property/media/cover-1.jpg";
const draftPath = "properties/draft-property/media/cover-1.jpg";

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(resolve("firestore.rules"), "utf8") },
    storage: { rules: readFileSync(resolve("storage.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearStorage();
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
    await uploadBytes(ref(context.storage(), livePath), image, jpeg);
    await uploadBytes(ref(context.storage(), draftPath), image, jpeg);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("property photographs", () => {
  it("denies direct quarantine and guest-delivery access even to the host", async () => {
    const paths = ["properties/live-property/quarantine/submission/0.webp", "properties/live-property/published/submission/0.webp"];
    await testEnvironment.withSecurityRulesDisabled(async context => {
      for (const path of paths) await uploadBytes(ref(context.storage(), path), image, jpeg);
    });
    const viewers = [testEnvironment.unauthenticatedContext(), testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: "password" } }), testEnvironment.authenticatedContext("guest", { firebase: { sign_in_provider: "anonymous" } })];
    for (const viewer of viewers) for (const path of paths) {
      await assertFails(getBytes(ref(viewer.storage(), path)));
      await assertFails(uploadBytes(ref(viewer.storage(), path), image, jpeg));
    }
  });
  it("serves a live wall's photograph to a guest who never signs in", async () => {
    const guest = testEnvironment.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(guest, livePath)));
  });

  it("keeps an unpublished property's photographs off the internet", async () => {
    const guest = testEnvironment.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(guest, draftPath)));
  });

  it("lets the owner read, replace and delete their own property media", async () => {
    const owner = testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: "password" } });
    const storage = owner.storage();

    await assertSucceeds(getBytes(ref(storage, draftPath)));
    await assertSucceeds(uploadBytes(ref(storage, draftPath), image, jpeg));
    await assertSucceeds(deleteObject(ref(storage, draftPath)));
  });

  it("does not let another Host write to a property they do not own", async () => {
    const other = testEnvironment.authenticatedContext("host-b", { firebase: { sign_in_provider: "password" } });
    await assertFails(uploadBytes(ref(other.storage(), draftPath), image, jpeg));
    await assertFails(deleteObject(ref(other.storage(), livePath)));
  });

  it("refuses an anonymous Guest session, which is never an owner", async () => {
    const guest = testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: "anonymous" } });
    await assertFails(uploadBytes(ref(guest.storage(), draftPath), image, jpeg));
  });

  it("refuses a file that is not one of the accepted image types", async () => {
    const owner = testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: "password" } });
    await assertFails(
      uploadBytes(ref(owner.storage(), "properties/draft-property/media/booking.pdf"), image, {
        contentType: "application/pdf",
      })
    );
  });

  it("keeps everything outside a property's media folder default-deny", async () => {
    const owner = testEnvironment.authenticatedContext("host-a", { firebase: { sign_in_provider: "password" } });
    await assertFails(uploadBytes(ref(owner.storage(), "properties/draft-property/secrets.jpg"), image, jpeg));
    await assertFails(uploadBytes(ref(owner.storage(), "anything-else.jpg"), image, jpeg));
  });
});
