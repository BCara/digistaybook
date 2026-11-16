import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { NOTIFICATION_EMAIL_CONFIRMATIONS } from "./hostNotifications.js";
import { retireProperty } from "./propertyCreation.js";
import { stripeSecrets } from "./stripeConfig.js";

/* ===========================================================================
   hostAccount — a Host closing their account.

   There was no way to do it: a Host could delete each property and still be
   left with an account, a profile and their settings, and nobody to ask but
   support.

   Closing an account is every property being deleted, and then the account.
   In order, so that a failure part-way leaves something a retry finishes:

   1. each property is retired exactly as `deleteHostProperty` retires it —
      subscription ended first, then `lifecycle: deleted` — so nothing is still
      billing an account that no longer exists. A Stripe failure stops here
      with the account intact;
   2. the Host's profile and email settings are removed. The billing fields on
      `hosts/{uid}` (the Stripe customer reference and the record that the
      free trial was used) are kept for accounting;
   3. a content-free audit record is written;
   4. the sign-in itself is deleted, last, because it is the one step that
      cannot be retried by the Host: after it they cannot sign in to ask again.

   The properties' content is not removed here. It goes when the purge reaches
   it (`propertyPurge.ts`), which is also where an open safety hold is
   respected — closing an account does not release evidence.
   ========================================================================= */

/** How fresh the sign-in must be. Closing an account is not something a forgotten open tab should be able to do. */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

export function signedInRecently(authTime: unknown, now = Date.now()): boolean {
  return typeof authTime === "number" && now / 1000 - authTime <= RECENT_SIGN_IN_SECONDS && authTime <= now / 1000 + 60;
}

type Removal = {
  /** Removes the sign-in. Replaced in tests. */
  deleteUser?: (uid: string) => Promise<void>;
};

// Exported for trusted emulator verification; `deleteHostAccount` is the client endpoint.
export async function closeHostAccount(uid: string, appCheck: "verified" | "absent", removal: Removal = {}) {
  const db = getFirestore();
  const owned = await db.collection("properties").where("ownerUid", "==", uid).get();
  let retired = 0, subscriptionsCancelled = 0;
  for (const property of owned.docs) {
    if (property.get("lifecycle") === "deleted") continue;
    const result = await retireProperty(property.ref, uid, "account_delete");
    retired += 1;
    if (result.subscriptionCancelled) subscriptionsCancelled += 1;
  }

  const hostRef = db.doc(`hosts/${uid}`);
  const confirmations = await db.collection(NOTIFICATION_EMAIL_CONFIRMATIONS).where("uid", "==", uid).get();
  const batch = db.batch();
  for (const confirmation of confirmations.docs) batch.delete(confirmation.ref);
  batch.delete(db.doc(`users/${uid}`));
  if ((await hostRef.get()).exists) batch.update(hostRef, {
    notifications: FieldValue.delete(), notificationsSentAt: FieldValue.delete(), notificationEmailRequests: FieldValue.delete(),
    accountDeletedAt: FieldValue.serverTimestamp()
  });
  // No email address and no property names: who, when, and how much.
  batch.set(db.doc(`deletionAudits/account-${uid}`), {
    kind: "account_delete", uid, properties: owned.size, propertiesRetired: retired, subscriptionsCancelled,
    appCheck, at: FieldValue.serverTimestamp()
  });
  await batch.commit();

  await (removal.deleteUser ?? (id => getAuth().deleteUser(id)))(uid);
  logger.info("host_account_deleted", { properties: owned.size, subscriptionsCancelled });
  return { properties: owned.size, subscriptionsCancelled };
}

export const deleteHostAccount = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", secrets: stripeSecrets }, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in with your host account.");
  // A reviewer account carries staff access; it is removed by the people who granted it, not from this page.
  if (request.auth.token.admin === true) throw new HttpsError("failed-precondition", "This account has staff access and cannot be deleted here. Contact support.", { reason: "staff-account" });
  if (request.data?.confirm !== "delete my account") throw new HttpsError("invalid-argument", "Confirm that you want to delete your account.");
  if (!signedInRecently(request.auth.token.auth_time)) throw new HttpsError("failed-precondition", "Confirm your sign-in again before deleting your account.", { reason: "recent-sign-in-required" });
  const result = await closeHostAccount(request.auth.uid, request.app ? "verified" : "absent");
  return { success: true, ...result };
});
