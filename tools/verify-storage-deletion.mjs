import assert from "node:assert/strict";
import { createRequire } from "node:module";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST?.includes("9199"));
process.env.FUNCTIONS_EMULATOR = "true";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
initializeApp({ projectId: "demo-digistaybook" });
const { processStorageJob, runStorageDeletionSweep } = await import("../functions/lib/storageDeletion.js");
const db = getFirestore(), storage = getStorage(), now = Date.now();
const bucket = "demo-digistaybook.firebasestorage.app", publishedBucket = "demo-digistaybook-published.firebasestorage.app";
const propertyId = "deletion-worker-proof";
const old = Timestamp.fromMillis(now - 600_000);
const target = name => ({ bucket, path: `properties/${propertyId}/quarantine/${name}/0.webp` });
const save = async object => storage.bucket(object.bucket).file(object.path).save(Buffer.from("synthetic test bytes"));
const exists = async object => (await storage.bucket(object.bucket).file(object.path).exists())[0];
async function job(id, extra = {}) {
  const ref = db.doc(`deletionJobs/${id}`);
  await ref.set({ propertyId, paths: [], status: "pending", createdAt: old, ...extra }); return ref;
}

const first = target("primary"), second = { bucket: publishedBucket, path: `properties/${propertyId}/published/primary/0.webp` };
await save(first); await save(second);
const primary = await job("worker-primary", { objects: [first, second] });
await processStorageJob("deletionJobs", primary.id);
assert.equal((await primary.get()).get("status"), "complete");
assert.equal(await exists(first), false); assert.equal(await exists(second), false);
await processStorageJob("deletionJobs", primary.id); // Completed replay does nothing.

const retryObject = target("retry"); await save(retryObject);
const retry = await job("worker-retry", { objects: [retryObject, target("missing")] });
await processStorageJob("deletionJobs", retry.id, now, async () => { throw new Error("provider detail must not be stored"); });
assert.equal((await retry.get()).get("status"), "retry");
assert.equal((await retry.get()).get("failureCode"), "storage_delete_failed");
await processStorageJob("deletionJobs", retry.id, now + 60_001);
assert.equal((await retry.get()).get("status"), "complete"); assert.equal(await exists(retryObject), false);

const partialFirst = target("partial-first"), partialSecond = target("partial-second");
await save(partialFirst); await save(partialSecond);
const partial = await job("worker-partial", { objects: [partialFirst, partialSecond] });
let count = 0;
await processStorageJob("deletionJobs", partial.id, now, async object => {
  if (++count === 2) throw new Error("transient failure");
  await storage.bucket(object.bucket).file(object.path).delete({ ignoreNotFound: true });
});
assert.equal(await exists(partialFirst), false); assert.equal(await exists(partialSecond), true);
await processStorageJob("deletionJobs", partial.id, now + 60_001);
assert.equal(await exists(partialSecond), false); assert.equal((await partial.get()).get("status"), "complete");

const heldObject = target("held"); await save(heldObject);
const held = await job("worker-held", { objects: [heldObject], requiresSafetyReview: true });
await processStorageJob("deletionJobs", held.id);
assert.equal((await held.get()).get("status"), "held"); assert.equal(await exists(heldObject), true);

const bad = await job("worker-invalid", { objects: [heldObject, { bucket, path: "properties/someone-else/photo.webp" }] });
await processStorageJob("deletionJobs", bad.id);
assert.equal((await bad.get()).get("status"), "needs_attention"); assert.equal(await exists(heldObject), true);
const wrongBucket = await job("worker-bucket", { objects: [{ ...heldObject, bucket: "unapproved-bucket" }] });
await processStorageJob("deletionJobs", wrongBucket.id);
assert.equal((await wrongBucket.get()).get("failureCode"), "invalid_manifest");

const recent = await job("worker-upload-race", { objects: [target("late-upload")], createdAt: Timestamp.fromMillis(now) });
await processStorageJob("deletionJobs", recent.id, now);
assert.equal((await recent.get()).get("status"), "pending");
await save(target("late-upload")); // An already running upload finishes after deletion was requested.
await processStorageJob("deletionJobs", recent.id, now + 300_001);
assert.equal(await exists(target("late-upload")), false);

const concurrent = await job("worker-concurrent", { objects: [target("concurrent")] });
let release; const gate = new Promise(resolve => { release = resolve; });
let entered; const started = new Promise(resolve => { entered = resolve; });
let deletions = 0;
const running = processStorageJob("deletionJobs", concurrent.id, now, async () => { deletions++; entered(); await gate; });
await started;
await processStorageJob("deletionJobs", concurrent.id, now, async () => { deletions++; });
release(); await running; assert.equal(deletions, 1);

const expired = await job("worker-expired-lease", { status: "processing", leaseUntil: old, objects: [] });
await processStorageJob("deletionJobs", expired.id);
assert.equal((await expired.get()).get("status"), "complete");
const crashed = await job("worker-crash-limit", { status: "processing", leaseUntil: old, attempts: 8, objects: [heldObject] });
await processStorageJob("deletionJobs", crashed.id);
assert.equal((await crashed.get()).get("status"), "needs_attention"); assert.equal(await exists(heldObject), true);
await db.doc(`properties/${propertyId}/posts/active`).set({ visibility: "visible" });
const active = await job("worker-active", { postId: "active", objects: [heldObject] });
await processStorageJob("deletionJobs", active.id);
assert.equal((await active.get()).get("failureCode"), "state_mismatch"); assert.equal(await exists(heldObject), true);
const exhausted = await job("worker-exhausted", { attempts: 7, objects: [target("failure")] });
await processStorageJob("deletionJobs", exhausted.id, now, async () => { throw new Error("fail"); });
assert.equal((await exhausted.get()).get("status"), "needs_attention");

const cleanupId = "worker-cleanup", quarantine = target(cleanupId), delivered = { bucket: publishedBucket, path: `properties/${propertyId}/published/${cleanupId}/0.webp` };
await save(quarantine); await save(delivered);
await db.doc(`guestSubmissions/${cleanupId}`).set({ propertyId, mediaLocation: "published", status: "published" });
const cleanup = db.doc(`storageCleanup/${cleanupId}`);
await cleanup.set({ propertyId, bucket, paths: [quarantine.path], status: "pending", createdAt: old });
await processStorageJob("storageCleanup", cleanupId);
assert.equal((await cleanup.get()).get("status"), "complete");
assert.equal(await exists(quarantine), false); assert.equal(await exists(delivered), true);

// Re-read the submission's hold even if an old cleanup manifest omitted it.
await save(quarantine);
await db.doc(`guestSubmissions/${cleanupId}`).update({ safetyCaseOpen: true });
await cleanup.update({ status: "pending" });
await processStorageJob("storageCleanup", cleanupId);
assert.equal((await cleanup.get()).get("status"), "held"); assert.equal(await exists(quarantine), true);

const batch = db.batch();
for (let i = 0; i < 101; i++) batch.set(db.doc(`deletionJobs/worker-page-${String(i).padStart(3, "0")}`), { propertyId, paths: [], createdAt: old, status: "pending" });
await batch.commit();
await db.doc("workerState/deletionJobs").set({ cursor: null });
await runStorageDeletionSweep(); await runStorageDeletionSweep(); await runStorageDeletionSweep();
assert.equal((await db.doc("deletionJobs/worker-page-100").get()).get("status"), "complete");
console.log("Storage deletion verified: real two-bucket removal, retries, missing objects, safety holds, scope rejection, upload settling, leases, exhaustion, quarantine-only cleanup and queue pagination.");
